const permissionAPI = globalThis.browser || globalThis.chrome;
document.querySelector("#allow").addEventListener("click", async () => {
  try {
    const allowed =
      typeof browser !== "undefined" && browser.runtime.getBrowserInfo
        ? await browser.permissions.request({
            data_collection: ["personalCommunications", "websiteContent"],
          })
        : true;
    await permissionAPI.storage.local.set({ aiConsent: allowed });
    document.querySelector("#status").textContent = allowed
      ? "Permission granted. Return to STRIKEOUT and refresh Pop settings."
      : "Permission declined. Page checks, sharing guard and local evidence still work.";
  } catch {
    document.querySelector("#status").textContent =
      "The browser could not grant permission. Update Firefox/Zen and try again.";
  }
});
