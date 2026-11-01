const get = (id) => document.getElementById(id);
const Pop = globalThis.Pop;
const Evidence = globalThis.PopEvidence;
let capture = null;
let captureImage = null;
let rectangles = [];
let drawing = null;
let previewUrls = [];
let chatBusy = false;

function status(text) {
  get("app-status").textContent = text;
}
function report(error) {
  status(
    error.message ||
      "That did not work. Your existing local records have been kept.",
  );
}
async function send(message) {
  const result = await PopAPI.runtime.sendMessage(message);
  if (result?.error) throw Error(result.error);
  return result;
}
function button(text, action, className = "") {
  const element = document.createElement("button");
  element.textContent = text;
  element.className = className;
  element.onclick = () => Promise.resolve().then(action).catch(report);
  return element;
}

async function renderWatchlist() {
  const settings = await PopAPI.storage.local.get("watchlist");
  get("watch-items").replaceChildren();
  for (const item of settings.watchlist || []) {
    const row = document.createElement("p");
    row.className = "entry";
    row.textContent = item.kind + ": " + item.value;
    row.append(
      button("Remove", async () => {
        const current = await PopAPI.storage.local.get("watchlist");
        await PopAPI.storage.local.set({
          watchlist: current.watchlist.filter((entry) => entry.id !== item.id),
        });
        await renderWatchlist();
      }),
    );
    get("watch-items").append(row);
  }
  if (!get("watch-items").children.length)
    get("watch-items").textContent =
      "No identifiers yet. Pop is not guessing who you are.";
}

get("watch-form").onsubmit = async (event) => {
  event.preventDefault();
  const submit = get("watch-form").querySelector("button");
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    const kind = get("watch-kind").value;
    const value = get("watch-value").value.trim();
    const error = Pop.validateIdentifier(kind, value);
    if (error) throw Error(error);
    const current = await PopAPI.storage.local.get("watchlist");
    const watchlist = current.watchlist || [];
    if (watchlist.length >= 30)
      throw Error("Keep the watchlist to 30 identifiers.");
    if (
      watchlist.some(
        (item) =>
          item.kind === kind &&
          item.value.toLowerCase() === value.toLowerCase(),
      )
    )
      throw Error("That identifier is already watched.");
    await PopAPI.storage.local.set({
      watchlist: [...watchlist, { id: crypto.randomUUID(), kind, value }],
    });
    get("watch-value").value = "";
    status("Added locally. Use Check this page on a website to find it.");
    await renderWatchlist();
  } catch (error) {
    report(error);
  } finally {
    submit.disabled = false;
  }
};

async function renderIncidents() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  const records = await Evidence.all();
  records.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.incident)) groups.set(record.incident, []);
    groups.get(record.incident).push(record);
  }
  const list = get("incident-items");
  list.replaceChildren();
  if (!records.length) {
    list.textContent =
      "No evidence saved yet. Capture a page from the Pop toolbar to begin.";
    return;
  }
  for (const [name, items] of groups) {
    const group = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = name;
    group.append(
      title,
      button("Export incident with screenshots", () =>
        Evidence.exportIncident(items),
      ),
    );
    group.append(
      button(
        "Delete incident",
        async () => {
          if (
            !confirm(
              "Delete all local evidence in this incident? Exported copies remain.",
            )
          )
            return;
          for (const item of items) await Evidence.remove(item.id);
          await renderIncidents();
        },
        "danger",
      ),
    );
    for (const item of items) {
      const entry = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent =
        (item.title || "Captured page") +
        " · " +
        new Date(item.capturedAt).toLocaleString();
      const metadata = document.createElement("p");
      metadata.className = "capture-meta";
      metadata.textContent =
        item.address + "\n" + item.selectedText + "\n" + item.note;
      const image = document.createElement("img");
      image.alt = "Reviewed evidence screenshot";
      image.className = "evidence-image";
      image.src = URL.createObjectURL(item.image);
      previewUrls.push(image.src);
      entry.append(
        summary,
        metadata,
        image,
        button("Download screenshot", () =>
          Evidence.download(
            "pop-evidence-" + item.id.slice(0, 8) + ".png",
            item.image,
          ),
        ),
      );
      entry.append(
        button("Prepare STRIKEOUT handoff", () => prepareHandoff(item)),
      );
      entry.append(
        button(
          item.websiteId ? "Sync again to website" : "Sync to website library",
          async () => {
            try {
              await syncCapture(item);
              status("Saved to your website evidence library.");
              await renderIncidents();
            } catch (error) {
              report(error);
            }
          },
        ),
      );
      if (item.html)
        entry.append(
          button("Download inert HTML snapshot", () =>
            Evidence.download(
              "pop-page-" + item.id + ".html",
              new Blob(
                [
                  "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'\">" +
                    item.html,
                ],
                { type: "text/html" },
              ),
            ),
          ),
        );
      entry.append(
        button(
          "Delete this record",
          async () => {
            if (!confirm("Delete this local evidence record?")) return;
            await Evidence.remove(item.id);
            await renderIncidents();
          },
          "danger",
        ),
      );
      group.append(entry);
    }
    list.append(group);
  }
}

async function prepareHandoff(record) {
  const settings = await PopAPI.storage.local.get("server");
  // This exports reviewed TEXT into an editable website draft; no hidden upload.
  const handoff = {
    kind: "I’m not sure.",
    link: record.address,
    description:
      "Evidence captured at " +
      record.capturedAt +
      " (device clock).\n" +
      record.selectedText +
      "\nNotes: " +
      record.note,
  };
  if (
    !confirm(
      "Open a STRIKEOUT draft with this record’s address, capture time, selected text and note? The screenshot is NOT uploaded. Download and attach it separately if needed.",
    )
  )
    return;
  await PopAPI.tabs.create({
    url:
      (settings.server || Pop.defaultServer) +
      "/incident#handoff=" +
      encodeURIComponent(JSON.stringify(handoff)),
  });
}

function paintRedactions(preview) {
  if (!captureImage) return;
  const canvas = get("redaction");
  const context = canvas.getContext("2d");
  context.drawImage(captureImage, 0, 0);
  context.fillStyle = "#141019";
  for (const rectangle of [...rectangles, ...(preview ? [preview] : [])])
    context.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
}

function point(event) {
  const canvas = get("redaction");
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        canvas.width,
        ((event.clientX - rect.left) * canvas.width) / rect.width,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        canvas.height,
        ((event.clientY - rect.top) * canvas.height) / rect.height,
      ),
    ),
  };
}

function rectangleBetween(a, b) {
  const x = Math.floor(Math.min(a.x, b.x));
  const y = Math.floor(Math.min(a.y, b.y));
  return {
    x,
    y,
    width: Math.ceil(Math.max(a.x, b.x)) - x,
    height: Math.ceil(Math.max(a.y, b.y)) - y,
  };
}

get("redaction").onpointerdown = (event) => {
  if (!captureImage) return;
  drawing = point(event);
  get("redaction").setPointerCapture(event.pointerId);
};
get("redaction").onpointermove = (event) => {
  if (drawing) paintRedactions(rectangleBetween(drawing, point(event)));
};
get("redaction").onpointerup = (event) => {
  if (!drawing) return;
  const rectangle = rectangleBetween(drawing, point(event));
  if (rectangle.width > 1 && rectangle.height > 1) rectangles.push(rectangle);
  drawing = null;
  paintRedactions();
};
get("redaction").onpointercancel = () => {
  drawing = null;
  paintRedactions();
};
get("redact-add").onclick = () => {
  const rectangle = {
    x: Number(get("redact-x").value),
    y: Number(get("redact-y").value),
    width: Number(get("redact-width").value),
    height: Number(get("redact-height").value),
  };
  if (
    !captureImage ||
    Object.values(rectangle).some((value) => !Number.isFinite(value)) ||
    rectangle.x < 0 ||
    rectangle.y < 0 ||
    rectangle.width <= 0 ||
    rectangle.height <= 0 ||
    rectangle.x >= get("redaction").width ||
    rectangle.y >= get("redaction").height
  ) {
    status("Enter a rectangle within the screenshot.");
    return;
  }
  rectangles.push(rectangle);
  paintRedactions();
};
get("redact-undo").onclick = () => {
  rectangles.pop();
  paintRedactions();
};

async function loadCapture(id) {
  const key = "capture:" + id;
  const pending = await PopAPI.storage.session.get(key);
  if (!pending[key])
    throw Error(
      "This pending capture expired or was already opened. Capture the page again.",
    );
  capture = { ...pending[key], id, pendingKey: key };
  rectangles = [];
  captureImage = new Image();
  await new Promise((resolve, reject) => {
    captureImage.onload = resolve;
    captureImage.onerror = () =>
      reject(Error("The screenshot could not be opened."));
    captureImage.src = capture.screenshot;
  });
  // The pending original stays in session storage until save/discard so a
  // reload can reopen the review. It is not a saved evidence record yet.
  delete capture.screenshot;
  get("redaction").width = captureImage.naturalWidth;
  get("redaction").height = captureImage.naturalHeight;
  paintRedactions();
  get("capture-meta").textContent =
    "Captured " +
    new Date(capture.capturedAt).toLocaleString() +
    " (device clock). Only the visible tab area was captured. " +
    (capture.htmlNote || "");
  get("capture-address").value = capture.address;
  get("capture-title").value = capture.title;
  get("capture-selection").value = capture.selectedText;
  get("capture-note").value = "";
  get("capture-incident").value = capture.incidentName || "";
  get("capture-html").value = capture.html || "";
  get("capture-html-include").checked = !!capture.quick;
  get("capture-sync").checked = !!capture.quick;
  get("capture-email").checked = !!capture.quick;
  status("Screenshot captured, NOT SAVED yet. Enter an incident name, review the sharing options, then press Save evidence.");
  get("capture-incident").focus();
}

function discardCapture() {
  capture = null;
  captureImage = null;
  rectangles = [];
  drawing = null;
  get("redaction").width = 1;
  get("redaction").height = 1;
  for (const id of [
    "capture-address",
    "capture-title",
    "capture-selection",
    "capture-note",
    "capture-incident",
  ])
    get(id).value = "";
}

async function syncCapture(record) {
  let image = record.image;
  if (image.size > 480 * 1024) {
    const bitmap = await createImageBitmap(image),
      canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    for (const quality of [0.92, 0.82, 0.65, 0.5]) {
      image = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (image.size <= 480 * 1024) break;
    }
    bitmap.close();
  }
  if (image.size > 500 * 1024)
    throw Error(
      "Screenshot is too large to sync. Save it locally and crop the capture before retrying.",
    );
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(image);
  });
  const result = await send({
    type: "POP_EVIDENCE_SYNC",
    evidence: {
      id: record.id,
      name: record.incident,
      title: record.title,
      address: record.address,
      capturedAt: record.capturedAt,
      selectedText: record.selectedText,
      note: record.note,
      redactionCount: record.redactionCount,
      imageData: data,
      html: record.html || "",
    },
  });
  record.websiteId = result.item.id;
  record.syncedAt = new Date().toISOString();
  await Evidence.save(record);
  return result;
}

get("capture-save").onclick = async () => {
  get("capture-save").disabled = true;
  try {
    if (!capture || !captureImage) throw Error("Capture a page first.");
    const incident = get("capture-incident").value.trim();
    if (!incident)
      throw Error(
        "Give this incident a name. Reuse the same name to group records.",
      );
    const address = Pop.cleanAddress(get("capture-address").value);
    if (!address) throw Error("Review the HTTP or HTTPS page address.");
    paintRedactions();
    const image = await new Promise((resolve) =>
      get("redaction").toBlob(resolve, "image/png"),
    );
    if (!image) throw Error("The reviewed screenshot could not be created.");
    const records = await Evidence.all();
    if (records.length >= 50)
      throw Error(
        "Export and delete older evidence before saving more than 50 records.",
      );
    if (
      records.reduce((total, item) => total + item.image.size, 0) + image.size >
      80 * 1024 * 1024
    )
      throw Error(
        "Local evidence is limited to 80 MB. Export and delete older records first.",
      );
    const record = {
      id: capture.id || (capture.id = crypto.randomUUID()),
      incident,
      image,
      address,
      title: get("capture-title").value,
      capturedAt: capture.capturedAt,
      selectedText: get("capture-selection").value,
      note: get("capture-note").value,
      redactionCount: rectangles.length,
      html: get("capture-html-include").checked
        ? get("capture-html").value
        : "",
    };
    await Evidence.save(record);
    const syncRequested = get("capture-sync").checked || get("capture-email").checked;
    const emailRequested = get("capture-email").checked;
    await PopAPI.storage.session.remove(capture.pendingKey);
    discardCapture();
    location.hash = "incidents";
    await renderIncidents();
    status(syncRequested ? "Saved locally. Syncing to your website account…" : "Saved locally in Pop → Evidence. This capture has NOT been uploaded to the website.");
    let message = "Saved locally in Pop → Evidence. Not uploaded to the website.";
    if (syncRequested) {
      try {
        await syncCapture(record);
        message =
          "Saved to your website evidence library. Attach it to any case from Pop evidence.";
        if (emailRequested) {
          try {
            await send({ type: "POP_EVIDENCE_EMAIL", id: record.id });
            message += " Email service accepted the bundle.";
          } catch (error) {
            message += " Email not sent: " + error.message;
          }
        }
      } catch (error) {
        message += " Website sync failed: " + error.message;
      }
    }
    await renderIncidents();
    status(message);
  } catch (error) {
    report(error);
  } finally {
    get("capture-save").disabled = false;
  }
};
get("capture-discard").onclick = () => {
  if (capture?.pendingKey) PopAPI.storage.session.remove(capture.pendingKey).catch(report);
  discardCapture();
  location.hash = "incidents";
  status("Capture discarded.");
};

async function renderChat() {
  let session = await PopAPI.storage.session.get("chatHistory");
  try {
    const shared = await send({ type: "POP_CHAT_HISTORY" });
    session = { chatHistory: shared.messages };
    get("chat-context").textContent = shared.context
      ? "Shared context: " + shared.context.title
      : "Shared context: no case included.";
  } catch (error) {
    get("chat-context").textContent = error.message;
  }
  get("chat-log").replaceChildren();
  for (const message of session.chatHistory || []) {
    const bubble = document.createElement("div");
    bubble.className = "chat-message " + message.role;
    bubble.textContent =
      (message.role === "user" ? "You: " : "Pop: ") + message.text;
    get("chat-log").append(bubble);
  }
  get("chat-log").scrollTop = get("chat-log").scrollHeight;
}
get("chat-address").oninput = () => {
  const address = Pop.cleanAddress(get("chat-address").value);
  get("chat-address-preview").textContent = address
    ? "Address to send: " + address
    : "No page address will be sent.";
};
get("chat-form").onsubmit = async (event) => {
  event.preventDefault();
  if (chatBusy) return;
  chatBusy = true;
  get("chat-send").disabled = true;
  get("chat-clear").disabled = true;
  const message = get("chat-message").value.trim();
  try {
    if (!message) throw Error("Type a question first.");
    status("Pop is thinking…");
    await send({
      type: "POP_CHAT",
      message,
      pageAddress: get("chat-address").value,
    });
    get("chat-message").value = "";
    get("chat-address").value = "";
    get("chat-address-preview").textContent = "";
    await renderChat();
    status("");
  } catch (error) {
    report(error);
  } finally {
    chatBusy = false;
    get("chat-send").disabled = false;
    get("chat-clear").disabled = false;
  }
};
get("chat-clear").onclick = async () => {
  try {
    await send({ type: "POP_CHAT_CLEAR" });
    await PopAPI.storage.session.remove("chatHistory");
    await renderChat();
    status(
      "Shared conversation cleared on the website and extension. Provider copies are separate.",
    );
  } catch (error) {
    report(error);
  }
};
setInterval(() => {
  if (
    location.hash === "#chat" &&
    document.visibilityState === "visible" &&
    !chatBusy
  )
    renderChat().catch(() => {});
}, 5000);

async function renderSettings() {
  const redirectSettings = await PopAPI.storage.local.get("server");
  location.replace(
    (redirectSettings.server || Pop.defaultServer) + "/?pop-settings=1",
  );
  return;
  const settings = await PopAPI.storage.local.get([
    "sharingGuard",
    "aiConsent",
    "server",
    "popToken",
    "disabledSites",
  ]);
  get("guard-enabled").checked = settings.sharingGuard !== false;
  get("ai-consent").checked = !!settings.aiConsent;
  get("server-address").value = settings.server || Pop.defaultServer;
  get("connection-status").textContent = settings.popToken
    ? "Paired. The server checks token validity when you send a message."
    : "Not connected. Local tools work without AI.";
  get("disabled-sites").replaceChildren();
  for (const site of settings.disabledSites || [])
    get("disabled-sites").append(
      button("Re-enable Pop on " + site, async () => {
        const current = await PopAPI.storage.local.get("disabledSites");
        await PopAPI.storage.local.set({
          disabledSites: current.disabledSites.filter(
            (value) => value !== site,
          ),
        });
        await renderSettings();
      }),
    );
  get("site-permissions").replaceChildren();
  const permissions = await PopAPI.permissions.getAll();
  for (const origin of permissions.origins || []) {
    if (origin === Pop.defaultServer + "/*") continue;
    get("site-permissions").append(
      button("Remove website access: " + origin, async () => {
        await PopAPI.permissions.remove({ origins: [origin] });
        await send({ type: "POP_SYNC" });
        await renderSettings();
      }),
    );
  }
}
get("guard-enabled").onchange = () =>
  PopAPI.storage.local
    .set({ sharingGuard: get("guard-enabled").checked })
    .catch(report);
get("wake").onclick = () =>
  PopAPI.storage.local
    .set({ snoozedUntil: 0 })
    .then(() => status("Pop is awake on enabled sites."))
    .catch(report);
get("ai-consent").onchange = async () => {
  try {
    let granted = get("ai-consent").checked;
    if (
      granted &&
      typeof browser !== "undefined" &&
      browser.runtime.getBrowserInfo
    ) {
      granted = await browser.permissions.request({
        data_collection: ["personalCommunications", "websiteContent"],
      });
    }
    await PopAPI.storage.local.set({ aiConsent: granted });
    get("ai-consent").checked = granted;
    if (!granted) status("AI is off. Local tools still work.");
  } catch (error) {
    get("ai-consent").checked = false;
    report(error);
  }
};
get("server-save").onclick = async () => {
  try {
    const server = new URL(get("server-address").value);
    if (
      server.username ||
      server.password ||
      (server.protocol !== "https:" &&
        !(
          server.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(server.hostname)
        ))
    )
      throw Error("Use HTTPS, or HTTP localhost for development.");
    const granted = await PopAPI.permissions.request({
      origins: [Pop.permissionPattern(server.href)],
    });
    if (!granted) throw Error("Server access was not granted.");
    const current = await PopAPI.storage.local.get("server");
    if ((current.server || Pop.defaultServer) !== server.origin) {
      const token = await PopAPI.storage.local.get("popToken");
      if (token.popToken) await send({ type: "POP_DISCONNECT" });
      await PopAPI.storage.local.set({ server: server.origin });
      await PopAPI.storage.session.remove("chatHistory");
    }
    status("Server address saved.");
    await renderSettings();
  } catch (error) {
    report(error);
  }
};
get("connect-open").onclick = async () => {
  const settings = await PopAPI.storage.local.get("server");
  await PopAPI.tabs.create({
    url: (settings.server || Pop.defaultServer) + "/pop-connect.html",
  });
};
get("pair").onclick = async () => {
  try {
    await send({ type: "POP_PAIR", code: get("pair-code").value.trim() });
    get("pair-code").value = "";
    await renderSettings();
    status("Pop is connected. Enable AI chat if you want to use it.");
  } catch (error) {
    report(error);
  }
};
get("disconnect").onclick = async () => {
  try {
    await send({ type: "POP_DISCONNECT" });
    await renderSettings();
    status("Chat access revoked.");
  } catch (error) {
    report(error);
  }
};
get("delete-all").onclick = async () => {
  if (
    !confirm(
      "Delete all local evidence, watchlist entries, pending captures and chat history? Exported or shared copies remain.",
    )
  )
    return;
  try {
    await Evidence.clear();
    await PopAPI.storage.local.remove("watchlist");
    await PopAPI.storage.session.clear();
    discardCapture();
    await renderWatchlist();
    await renderIncidents();
    await renderChat();
    status(
      "Local evidence, watchlist, pending captures and conversation deleted.",
    );
  } catch (error) {
    report(error);
  }
};

get("link-inspect").onclick = () => {
  get("link-results").replaceChildren();
  for (const finding of Pop.analyzeLink(
    get("link-label").value,
    get("link-address").value,
  )) {
    const paragraph = document.createElement("p");
    paragraph.textContent = finding;
    get("link-results").append(paragraph);
  }
};

async function navigate() {
  const route = location.hash.slice(1) || "watchlist";
  const section = route.split("/")[0];
  const sections = [
    "watchlist",
    "incidents",
    "capture",
    "chat",
    "links",
    "settings",
  ];
  const selected = sections.includes(section) ? section : "watchlist";
  for (const id of sections) get(id).hidden = id !== selected;
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.hash === "#" + selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  try {
    if (selected === "watchlist") await renderWatchlist();
    if (selected === "incidents") await renderIncidents();
    if (selected === "settings") await renderSettings();
    if (selected === "chat") await renderChat();
    if (selected === "capture" && !capture)
      await loadCapture(route.split("/")[1]);
    if (selected === "links") {
      const session = await PopAPI.storage.session.get("inspectedLink");
      if (session.inspectedLink) {
        get("link-address").value = session.inspectedLink;
        await PopAPI.storage.session.remove("inspectedLink");
      }
    }
  } catch (error) {
    report(error);
  }
}
window.addEventListener("hashchange", () => navigate());
window.addEventListener("beforeunload", (event) => {
  if (capture) {
    event.preventDefault();
    event.returnValue = "";
  }
});
PopAPI.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.chatHistory && !get("chat").hidden)
    renderChat().catch(report);
});
window.addEventListener("focus", () => {
  if (!get("incidents").hidden) renderIncidents().catch(report);
});
navigate();
