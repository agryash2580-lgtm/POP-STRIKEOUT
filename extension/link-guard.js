// Local, bounded lookalike protection. No browsing URLs are sent to a server.
globalThis.PopLinkGuard = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const isFirefox = typeof api.runtime.getBrowserInfo === "function";
  const brands = [
    "instagram.com",
    "facebook.com",
    "google.com",
    "paypal.com",
    "microsoft.com",
    "amazon.com",
    "netflix.com",
    "discord.com",
  ];
  const targets = new Map();
  for (const domain of brands) {
    const word = domain.split(".")[0];
    const variants = new Set();
    for (let i = 0; i < word.length; i++) {
      variants.add(word.slice(0, i) + word[i] + word.slice(i));
      variants.add(word.slice(0, i) + word.slice(i + 1));
      if (i < word.length - 1)
        variants.add(
          word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2),
        );
      const digit = { o: "0", i: "1", l: "1" }[word[i]];
      if (digit) variants.add(word.slice(0, i) + digit + word.slice(i + 1));
    }
    for (const variant of variants) {
      const typo = variant + ".com";
      if (!brands.includes(typo) && variant.length > 3)
        targets.set(typo, domain);
    }
  }
  const match = (host) => {
    host = host.toLowerCase();
    for (const [typo, real] of targets)
      if (host === typo || host.endsWith("." + typo)) return real;
    return null;
  };
  async function install() {
    if (!api.declarativeNetRequest) return;
    if (isFirefox) {
      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
      });
      return;
    }
    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: [
        {
          id: 1,
          priority: 1000,
          action: { type: "block" },
          condition: {
            requestDomains: [...targets.keys()],
            resourceTypes: ["main_frame"],
          },
        },
      ],
    });
  }
  api.runtime.onInstalled.addListener(() => install().catch(console.error));
  api.runtime.onStartup.addListener(() => install().catch(console.error));
  install().catch(console.error);
  const continuing = new Set(),
    warnings = new Map();
  // Firefox supports synchronous request interception. Redirect before contact.
  if (api.webRequest?.onBeforeRequest && isFirefox) {
    api.webRequest.onBeforeRequest.addListener(
      (details) => {
        if (continuing.has(details.tabId)) return {};
        if (match(new URL(details.url).hostname))
          return {
            redirectUrl:
              api.runtime.getURL("link-warning.html") +
              "#" +
              encodeURIComponent(details.url),
          };
        return {};
      },
      { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
      ["blocking"],
    );
  }

  function warn(details) {
    if (
      details.frameId !== 0 ||
      continuing.has(details.tabId) ||
      !match(new URL(details.url).hostname)
    )
      return;
    const previous = warnings.get(details.tabId);
    if (previous?.url === details.url && Date.now() - previous.at < 2000)
      return;
    warnings.set(details.tabId, { url: details.url, at: Date.now() });
    api.tabs
      .update(details.tabId, {
        url:
          api.runtime.getURL("link-warning.html") +
          "#" +
          encodeURIComponent(details.url),
      })
      .catch(() => {});
  }
  api.webNavigation.onBeforeNavigate.addListener(warn);
  api.webNavigation.onErrorOccurred.addListener(warn);
  api.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;
    continuing.delete(details.tabId);
    const rules = await api.declarativeNetRequest.getSessionRules();
    const removeRuleIds = rules
      .filter((r) => r.condition.tabIds?.includes(details.tabId))
      .map((r) => r.id);
    if (removeRuleIds.length)
      await api.declarativeNetRequest.updateSessionRules({ removeRuleIds });
  });
  async function continueOnce(tabId, address) {
    const url = new URL(address);
    if (!["http:", "https:"].includes(url.protocol) || !match(url.hostname))
      throw Error("This destination is not covered by the lookalike guard.");
    const id = 100000 + tabId;
    continuing.add(tabId);
    warnings.delete(tabId);
    await api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: [
        {
          id,
          priority: 2000,
          action: { type: "allow" },
          condition: {
            tabIds: [tabId],
            requestDomains: [url.hostname],
            resourceTypes: ["main_frame"],
          },
        },
      ],
    });
    await api.tabs.update(tabId, { url: url.href });
    return { ok: true };
  }
  return { match, continueOnce };
})();
