// Restricted to the configured STRIKEOUT website. Never exposes the chat token.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  let enabled = false;
  api.storage.local.get("server").then((settings) => {
    enabled =
      location.origin ===
        (settings.server || "https://strikeout-wheat.vercel.app") ||
      ["http://localhost:3002", "http://127.0.0.1:3002"].includes(
        location.origin,
      );
    if (enabled)
      window.postMessage(
        { type: "POP_WEBSITE_READY", version: "2.1.3" },
        location.origin,
      );
  });
  window.addEventListener("message", async (event) => {
    if (
      !enabled ||
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.type !== "STRIKEOUT_POP_SETTINGS"
    )
      return;
    const { id, action, value } = event.data;
    if (typeof id !== "string" || id.length > 80) return;
    try {
      if (action === "ping") {
        window.postMessage(
          {
            type: "POP_SETTINGS_RESULT",
            id,
            result: { installed: true, version: "2.1.3" },
          },
          location.origin,
        );
        return;
      }
      const prefs = await api.storage.local.get("websiteSettingsAllowed");
      if (
        !prefs.websiteSettingsAllowed &&
        !confirm(
          "Allow this STRIKEOUT website to manage Pop settings and your local identifier watchlist? It cannot read your saved screenshots or chat token.",
        )
      )
        throw Error("Website settings connection was not approved.");
      await api.storage.local.set({ websiteSettingsAllowed: true });
      let result;
      if (action === "get") {
        const x = await api.storage.local.get([
          "watchlist",
          "sharingGuard",
          "disabledSites",
          "aiConsent",
          "server",
          "popToken",
        ]);
        result = {
          watchlist: x.watchlist || [],
          sharingGuard: x.sharingGuard !== false,
          disabledSites: x.disabledSites || [],
          aiConsent: !!x.aiConsent,
          server: x.server || "https://strikeout-wheat.vercel.app",
          paired: !!x.popToken,
        };
      } else if (action === "save") {
        if (
          !value ||
          !Array.isArray(value.watchlist) ||
          value.watchlist.length > 30 ||
          value.watchlist.some(
            (x) =>
              !["email", "phone", "username"].includes(x.kind) ||
              typeof x.value !== "string" ||
              x.value.length > 150,
          )
        )
          throw Error("Invalid watchlist.");
        await api.storage.local.set({
          watchlist: value.watchlist.map((x) => ({
            id: String(x.id || crypto.randomUUID()),
            kind: x.kind,
            value: x.value.trim(),
          })),
          sharingGuard: value.sharingGuard !== false,
          aiConsent: !!value.aiConsent,
        });
        result = { saved: true };
      } else if (action === "pair") {
        result = await api.runtime.sendMessage({
          type: "POP_WEBSITE_PAIR",
          code: String(value?.code || ""),
        });
        if (result?.error) throw Error(result.error);
      } else if (action === "allow-ai") {
        await api.runtime.sendMessage({ type: "POP_AI_PERMISSION" });
        result = { opened: true };
      } else if (action === "disconnect") {
        const response = await api.runtime.sendMessage({
          type: "POP_WEBSITE_DISCONNECT",
        });
        if (response?.error) throw Error(response.error);
        await api.storage.local.set({ aiConsent: false });
        result = { saved: true };
      } else if (action === "wake") {
        await api.storage.local.set({ snoozedUntil: 0, disabledSites: [] });
        result = { saved: true };
      } else throw Error("Unknown settings action.");
      window.postMessage(
        { type: "POP_SETTINGS_RESULT", id, result },
        location.origin,
      );
    } catch (error) {
      window.postMessage(
        { type: "POP_SETTINGS_RESULT", id, error: error.message },
        location.origin,
      );
    }
  });
})();
