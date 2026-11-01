const get = (id) => document.getElementById(id);
let activeTab;

async function send(message) {
  const result = await PopAPI.runtime.sendMessage(message);
  if (result?.error) throw Error(result.error);
  return result;
}

async function run(command) {
  try {
    if (!activeTab?.id || !/^https?:/.test(activeTab.url || ""))
      throw Error(
        "Open an ordinary website first. Browser settings and extension stores cannot host Pop.",
      );
    get("status").textContent = "One moment…";
    if (command === "POP_SHOW") {
      const settings = await PopAPI.storage.local.get("disabledSites");
      const hostname = new URL(activeTab.url).hostname;
      await PopAPI.storage.local.set({
        snoozedUntil: 0,
        disabledSites: (settings.disabledSites || []).filter(
          (site) => site !== hostname,
        ),
      });
    }
    const result = await send({
      type: "POP_BRING",
      tabId: activeTab.id,
      command,
    });
    get("status").textContent =
      result?.note && command !== "POP_SHOW"
        ? result.note
        : "Pop is here. Click him for head pats. Drag to move.";
    get("matches").hidden = !result?.count;
    return result;
  } catch (error) {
    get("status").textContent = error.message;
  }
}

async function allow(allSites) {
  try {
    if (!/^https?:/.test(activeTab?.url || ""))
      throw Error("Open an ordinary website first.");
    const origin = Pop.permissionPattern(activeTab.url);
    const granted = await PopAPI.permissions.request({
      origins: allSites ? ["https://*/*", "http://*/*"] : [origin],
    });
    if (!granted)
      throw Error(
        "Permission was not granted. Bring Pop here still works for this visit.",
      );
    const settings = await PopAPI.storage.local.get("disabledSites");
    const hostname = new URL(activeTab.url).hostname;
    await PopAPI.storage.local.set({
      disabledSites: (settings.disabledSites || []).filter(
        (site) => site !== hostname,
      ),
    });
    await send({ type: "POP_SYNC" });
    await run("POP_SHOW");
  } catch (error) {
    get("status").textContent = error.message;
  }
}

get("bring").onclick = () => run("POP_SHOW");
get("scan").onclick = () => run("POP_SCAN");
get("draft").onclick = () => run("POP_DRAFT");
get("pet").onclick = () => {
  const desk = document.querySelector(".pet-desk");
  desk.classList.remove("petted");
  void desk.offsetWidth;
  desk.classList.add("petted");
  run("POP_PET");
};
get("minimise").onclick = async () => {
  if ((await run("POP_MINIMISE"))?.ok) window.close();
};
get("snooze").onclick = () => run("POP_SNOOZE");
get("disable").onclick = () => run("POP_DISABLE");
get("previous").onclick = () => run("POP_PREVIOUS");
get("next").onclick = () => run("POP_NEXT");
get("clear").onclick = () => run("POP_CLEAR");
get("chat").onclick = () =>
  send({ type: "POP_CHAT_WINDOW" }).catch((error) => {
    get("status").textContent = error.message;
  });
get("allow-site").onclick = () => allow(false);
get("allow-all").onclick = () => allow(true);
get("capture").onclick = async () => {
  get("capture").disabled = true;
  try {
    if (!activeTab?.id) throw Error("Choose a website first.");
    await send({ type: "POP_CAPTURE", tabId: activeTab.id });
    window.close();
  } catch (error) {
    get("status").textContent = error.message;
  } finally {
    get("capture").disabled = false;
  }
};
PopAPI.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  activeTab = tabs[0];
  if (/^https?:/.test(activeTab?.url || ""))
    get("site").textContent = "Here: " + new URL(activeTab.url).hostname;
  if (activeTab?.id)
    PopAPI.tabs
      .sendMessage(activeTab.id, { type: "POP_STATE" })
      .then((result) => {
        get("matches").hidden = !result?.count;
      })
      .catch(() => {});
});
