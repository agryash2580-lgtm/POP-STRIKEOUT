// Background code bridges the page companion and privileged browser APIs.
if (typeof importScripts === "function")
  importScripts("shared.js", "link-domains.js", "link-guard.js");
const Pop = globalThis.Pop;
let scriptUpdate = Promise.resolve();

function syncScripts() {
  // Permission events and a toolbar click can arrive together. Serialize updates.
  scriptUpdate = scriptUpdate.catch(() => {}).then(updateScripts);
  return scriptUpdate;
}

async function updateScripts() {
  const permissions = await PopAPI.permissions.getAll();
  const allowed = [];
  for (const origin of permissions.origins || []) {
    if (origin === "<all_urls>") allowed.push("https://*/*", "http://*/*");
    else if (/^https?:/.test(origin)) allowed.push(origin);
  }
  const matches = [...new Set(allowed)];
  await PopAPI.scripting
    .unregisterContentScripts({ ids: ["pop-companion"] })
    .catch(() => {});
  if (matches.length)
    await PopAPI.scripting.registerContentScripts([
      {
        id: "pop-companion",
        matches,
        js: Pop.scriptFiles,
        runAt: "document_idle",
        persistAcrossSessions: true,
        allFrames: false,
      },
    ]);
}

PopAPI.runtime.onInstalled.addListener(async () => {
  await PopAPI.contextMenus.removeAll();
  PopAPI.contextMenus.create({
    id: "pop-inspect",
    title: "Inspect this link with Pop",
    contexts: ["link"],
  });
  syncScripts().catch(console.error);
});
PopAPI.runtime.onStartup.addListener(() => syncScripts().catch(console.error));
PopAPI.permissions.onAdded.addListener(() =>
  syncScripts().catch(console.error),
);
PopAPI.permissions.onRemoved.addListener(() =>
  syncScripts().catch(console.error),
);
PopAPI.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "pop-inspect")
    PopAPI.storage.session
      .set({ inspectedLink: info.linkUrl || "" })
      .then(() => openWorkspace("links"));
});

function openWorkspace(section) {
  if (section === "settings" || section === "watchlist")
    return PopAPI.storage.local.get("server").then((x) =>
      PopAPI.tabs.create({
        url: (x.server || Pop.defaultServer) + "/?pop-settings=1",
      }),
    );
  return PopAPI.tabs.create({
    url: PopAPI.runtime.getURL("workspace.html#" + section),
  });
}

async function bringPop(tabId, command) {
  let ready;
  try {
    ready = await PopAPI.tabs.sendMessage(tabId, { type: "POP_PING" });
  } catch {}
  if (!ready || ready.version !== PopAPI.runtime.getManifest().version)
    await PopAPI.scripting.executeScript({
      target: { tabId },
      files: Pop.scriptFiles,
    });
  if (command) return PopAPI.tabs.sendMessage(tabId, { type: command });
  return { ok: true };
}

async function captureEvidence(tabId, askName = false) {
  const tab = await PopAPI.tabs.get(tabId);
  if (!/^https?:/.test(tab.url || ""))
    throw Error("Use an ordinary website for evidence capture.");
  const active = await PopAPI.tabs.query({
    active: true,
    windowId: tab.windowId,
  });
  if (active[0]?.id !== tab.id)
    throw Error("The active tab changed. Select the page and try again.");
  let metadata = { selectedText: "" };
  const snapshots = await PopAPI.scripting.executeScript({
    target: { tabId },
    func: (ask) => {
      // Ask for the name in our own review screen. Webpage dialogs can be
      // suppressed or unavailable while the extension popup has focus.
      const name = "";
      const copy = document.documentElement.cloneNode(true);
      copy
        .querySelectorAll(
          'script,iframe,object,embed,input[type=password],input[type=hidden],meta[http-equiv="refresh"],#strikeout-pop-pet',
        )
        .forEach((e) => e.remove());
      copy.querySelectorAll("input,textarea,select").forEach((e) => {
        e.removeAttribute("value");
        if (e.tagName !== "INPUT") e.textContent = "";
      });
      copy.querySelectorAll("*").forEach((e) => {
        for (const attr of [...e.attributes])
          if (
            /^on/i.test(attr.name) ||
            attr.name === "srcdoc" ||
            attr.name === "nonce"
          )
            e.removeAttribute(attr.name);
      });
      return {
        html: copy.outerHTML,
        name: String(name || "").slice(0, 100),
        quick: ask,
      };
    },
    args: [askName],
  });
  if (!snapshots[0]?.result) throw Error("Capture cancelled.");
  const snapshot = snapshots[0].result;
  if (snapshot.html.length > 1500000) {
    snapshot.html = "";
    snapshot.htmlNote =
      "HTML exceeded the capture limit; this capture contains the screenshot only.";
  }
  let hasPet = false;
  try {
    const response = await PopAPI.tabs.sendMessage(tabId, {
      type: "POP_BEFORE_CAPTURE",
    });
    if (response) {
      metadata = response;
      hasPet = true;
    }
  } catch {}
  let screenshot;
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    screenshot = await PopAPI.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
  } finally {
    if (hasPet)
      await PopAPI.tabs
        .sendMessage(tabId, { type: "POP_AFTER_CAPTURE" })
        .catch(() => {});
  }
  const after = await PopAPI.tabs.query({
    active: true,
    windowId: tab.windowId,
  });
  const afterTab = await PopAPI.tabs.get(tabId);
  if (after[0]?.id !== tabId || afterTab.url !== tab.url)
    throw Error("The page changed during capture. Please retry.");
  const id = crypto.randomUUID();
  await PopAPI.storage.session.set({
    ["capture:" + id]: {
      screenshot,
      html: snapshot.html,
      htmlNote: snapshot.htmlNote || "",
      incidentName: snapshot.name,
      quick: snapshot.quick,
      address: Pop.cleanAddress(tab.url),
      title: tab.title || "",
      capturedAt: new Date().toISOString(),
      selectedText: String(metadata.selectedText || "").slice(0, 12000),
    },
  });
  await openWorkspace("capture/" + id);
  return { ok: true };
}

async function serverRequest(
  path,
  body,
  token,
  serverOverride,
  method = "POST",
) {
  const settings = await PopAPI.storage.local.get(["server"]);
  const server = serverOverride || settings.server || Pop.defaultServer;
  const response = await fetch(server + path, {
    method,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || "The server could not complete that request.");
  return result;
}

async function chat(message, pageAddress) {
  const settings = await PopAPI.storage.local.get(["aiConsent", "popToken"]);
  if (!settings.aiConsent)
    throw Error("Review the AI disclosure and enable chat in Settings first.");
  if (typeof browser !== "undefined" && browser.runtime.getBrowserInfo) {
    const permitted = await browser.permissions.contains({
      data_collection: ["personalCommunications", "websiteContent"],
    });
    if (!permitted)
      throw Error(
        "Firefox’s AI permission is off. Re-enable AI chat in Settings.",
      );
  }
  if (!settings.popToken)
    throw Error("Connect Pop to STRIKEOUT in Settings first.");
  const session = await PopAPI.storage.session.get(["chatHistory"]);
  const history = session.chatHistory || [];
  const result = await serverRequest(
    "/api/pop/chat",
    {
      message,
      history: history.slice(-8),
      pageAddress: Pop.cleanAddress(pageAddress || ""),
    },
    settings.popToken,
  );
  const next = result.messages || [
    ...history,
    { role: "user", text: message },
    { role: "assistant", text: result.text },
  ];
  await PopAPI.storage.session.set({
    chatHistory: next,
    chatRevision: result.revision,
  });
  return { text: result.text };
}

async function reviewVisiblePage(tabId) {
  const tab = await PopAPI.tabs.get(tabId);
  if (!/^https?:/.test(tab.url || ""))
    throw Error("Choose an ordinary webpage.");
  const results = await PopAPI.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (
        !confirm(
          "Open STRIKEOUT with up to 12,000 characters of text visible on this page? Review it there before running a check. No screenshots, passwords from form fields, watchlist or AI context are attached.",
        )
      )
        return null;
      return {
        text: (
          window.getSelection()?.toString() || document.body.innerText
        ).slice(0, 12000),
        sourceUrl: location.href,
      };
    },
  });
  const snapshot = results[0]?.result;
  if (!snapshot) return { ok: true, cancelled: true };
  snapshot.sourceUrl = Pop.cleanAddress(snapshot.sourceUrl);
  const encoded = btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(snapshot))),
  );
  const settings = await PopAPI.storage.local.get("server");
  await PopAPI.tabs.create({
    url: (settings.server || Pop.defaultServer) + "/#pop-review=" + encoded,
  });
  return { ok: true };
}

async function handleMessage(message, sender) {
  if (message.type === "POP_REVIEW_SELF") {
    if (!sender.tab?.id) throw Error("Choose an ordinary webpage.");
    return reviewVisiblePage(sender.tab.id);
  }
  if (message.type === "POP_WEBSITE_DISCONNECT") {
    const settings = await PopAPI.storage.local.get("server");
    const origin = new URL(sender.url).origin;
    if (
      ![
        settings.server || Pop.defaultServer,
        Pop.defaultServer,
        "https://strikeout-wheat.vercel.app",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
      ].includes(origin)
    )
      throw Error("Use the STRIKEOUT website.");
    return handleMessage(
      { type: "POP_DISCONNECT" },
      { url: PopAPI.runtime.getURL("workspace.html") },
    );
  }
  if (message.type === "POP_AI_PERMISSION") {
    const origin = new URL(sender.url).origin;
    const settings = await PopAPI.storage.local.get("server");
    if (
      ![
        settings.server || Pop.defaultServer,
        Pop.defaultServer,
        "https://strikeout-wheat.vercel.app",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
      ].includes(origin)
    )
      throw Error("Use the STRIKEOUT website.");
    await PopAPI.tabs.create({
      url: PopAPI.runtime.getURL("ai-permission.html"),
    });
    return { ok: true };
  }
  if (message.type === "POP_WEBSITE_PAIR") {
    const settings = await PopAPI.storage.local.get("server");
    const origin = new URL(sender.url).origin;
    if (
      ![
        settings.server || Pop.defaultServer,
        Pop.defaultServer,
        "https://strikeout-wheat.vercel.app",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
      ].includes(origin)
    )
      throw Error("Use your STRIKEOUT website.");
    if (!/^[a-f0-9]{32}$/.test(message.code))
      throw Error("Get a fresh pairing code.");
    // The visited, approved website becomes this extension's backend.
    const result = await serverRequest(
      "/api/pop/pair",
      { code: message.code },
      undefined,
      origin,
    );
    await PopAPI.storage.local.set({ server: origin, popToken: result.token });
    await PopAPI.storage.session.remove("chatHistory");
    return { ok: true };
  }
  if (message.type === "POP_CAPTURE_SELF") {
    if (!sender.tab?.id || !/^https?:/.test(sender.url || ""))
      throw Error("Use Pop on an ordinary webpage.");
    return captureEvidence(sender.tab.id, !!message.askName);
  }
  // The page companion gets only narrow actions, never arbitrary server access.
  if (message.type === "POP_OPEN")
    return openWorkspace(
      ["watchlist", "settings", "incidents", "chat"].includes(message.section)
        ? message.section
        : "chat",
    ).then(() => ({ ok: true }));
  if (message.type === "POP_CHAT_WINDOW") {
    await PopAPI.windows.create({
      url: PopAPI.runtime.getURL("workspace.html#chat"),
      type: "popup",
      width: 400,
      height: 540,
    });
    return { ok: true };
  }
  if (!sender.url?.startsWith(PopAPI.runtime.getURL("")))
    throw Error("Open this tool from the Pop toolbar.");
  switch (message.type) {
    case "POP_LINK_CONTINUE": {
      if (
        !sender.tab?.id ||
        !sender.url.startsWith(PopAPI.runtime.getURL("link-warning.html"))
      )
        throw Error("Use the link warning screen.");
      return PopLinkGuard.continueOnce(sender.tab.id, message.address);
    }
    case "POP_CHAT_HISTORY": {
      const settings = await PopAPI.storage.local.get("popToken");
      if (!settings.popToken)
        throw Error("Pair Pop with your website account first.");
      const result = await serverRequest(
        "/api/pop/conversation",
        undefined,
        settings.popToken,
        undefined,
        "GET",
      );
      const old = await PopAPI.storage.session.get("chatRevision");
      if (old.chatRevision !== result.revision)
        await PopAPI.storage.session.set({
          chatHistory: result.messages,
          chatRevision: result.revision,
        });
      return result;
    }
    case "POP_CHAT_CLEAR": {
      const settings = await PopAPI.storage.local.get("popToken");
      const result = await serverRequest(
        "/api/pop/conversation",
        undefined,
        settings.popToken,
        undefined,
        "DELETE",
      );
      await PopAPI.storage.session.remove("chatHistory");
      return result;
    }
    case "POP_EVIDENCE_SYNC": {
      const settings = await PopAPI.storage.local.get("popToken");
      if (!settings.popToken)
        throw Error(
          "Pair Pop with your website account before syncing evidence.",
        );
      return serverRequest(
        "/api/pop/evidence",
        message.evidence,
        settings.popToken,
      );
    }
    case "POP_EVIDENCE_EMAIL": {
      const settings = await PopAPI.storage.local.get("popToken");
      return serverRequest(
        "/api/pop/evidence/" + encodeURIComponent(message.id) + "/email",
        {},
        settings.popToken,
      );
    }
    case "POP_WEBSITE": {
      const settings = await PopAPI.storage.local.get("server");
      await PopAPI.tabs.create({ url: settings.server || Pop.defaultServer });
      return { ok: true };
    }
    case "POP_REVIEW_PAGE":
      return reviewVisiblePage(message.tabId);
    case "POP_BRING":
      return bringPop(message.tabId, message.command);
    case "POP_SYNC":
      await syncScripts();
      return { ok: true };
    case "POP_CAPTURE":
      return captureEvidence(message.tabId, !!message.askName);
    case "POP_PAIR": {
      const result = await serverRequest("/api/pop/pair", {
        code: message.code,
      });
      await PopAPI.storage.local.set({ popToken: result.token });
      await PopAPI.storage.session.remove("chatHistory");
      return { ok: true };
    }
    case "POP_DISCONNECT": {
      const settings = await PopAPI.storage.local.get("popToken");
      try {
        if (settings.popToken)
          await serverRequest("/api/pop/disconnect", {}, settings.popToken);
      } finally {
        await PopAPI.storage.local.remove("popToken");
        await PopAPI.storage.session.remove("chatHistory");
      }
      return { ok: true };
    }
    case "POP_CHAT":
      return chat(
        String(message.message || "").slice(0, 3000),
        message.pageAddress,
      );
    default:
      throw Error("Unknown Pop action.");
  }
}

PopAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    !message?.type?.startsWith("POP_") ||
    [
      "POP_PING",
      "POP_SCAN",
      "POP_DRAFT",
      "POP_BEFORE_CAPTURE",
      "POP_AFTER_CAPTURE",
      "POP_SHOW",
    ].includes(message.type)
  )
    return;
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        error: error.message || "Pop could not complete that action.",
      }),
    );
  return true;
});
