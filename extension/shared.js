// Shared, deterministic rules. These functions never call the internet or AI.
globalThis.Pop = globalThis.Pop || {};
// Firefox's browser namespace provides Promises; Chromium uses chrome.
globalThis.PopAPI = globalThis.browser || globalThis.chrome;
(() => {
  const Pop = globalThis.Pop;
  Pop.scriptFiles = ["shared.js", "page-scan.js", "sharing-guard.js", "pet.js"];
  Pop.defaultServer = "https://strikeout-wheat.vercel.app";
  Pop.permissionPattern = function (address) {
    const url = new URL(address);
    // WebExtension host patterns cover the host across ports.
    return url.protocol + "//" + url.hostname + "/*";
  };

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  Pop.validateIdentifier = function (kind, value) {
    value = String(value || "").trim();
    if (value.length > 150) return "Keep identifiers under 150 characters.";
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Enter a complete email address.";
    if (kind === "phone" && !/^\+?[\d\s().-]+$/.test(value))
      return "Use digits and ordinary phone separators.";
    if (kind === "phone" && !/^\d{7,15}$/.test(value.replace(/\D/g, "")))
      return "A phone number needs 7 to 15 digits, including its country code if used.";
    if (kind === "username" && !/^@?[\p{L}\p{N}_.-]{3,64}$/u.test(value))
      return "Use a username of 3 to 64 letters, digits, dots, dashes or underscores.";
    if (!["email", "phone", "username"].includes(kind))
      return "Choose an identifier type.";
    return "";
  };

  Pop.findMatches = function (text, watchlist) {
    const matches = [];
    for (const item of watchlist || []) {
      if (Pop.validateIdentifier(item.kind, item.value)) continue;
      const value = item.value.trim();
      const pattern =
        item.kind === "phone"
          ? "\\+?" + value.replace(/\D/g, "").split("").join("[\\s().-]*")
          : item.kind === "username"
            ? "@?" + escapeRegex(value.replace(/^@/, ""))
            : escapeRegex(value);
      const regex = new RegExp(pattern, "giu");
      for (const found of text.matchAll(regex)) {
        const start = found.index;
        const end = start + found[0].length;
        // Avoid matching ann@example.com inside joann@example.com or .evil suffixes.
        const boundary = item.kind === "phone" ? /\d/ : /[\p{L}\p{N}_@+-]/u;
        if (
          boundary.test(text[start - 1] || "") ||
          boundary.test(text[end] || "")
        )
          continue;
        if (
          item.kind !== "phone" &&
          ((text[end] === "." && /[\p{L}\p{N}]/u.test(text[end + 1] || "")) ||
            text[start - 1] === ".")
        )
          continue;
        matches.push({
          start,
          end,
          text: found[0],
          kind: item.kind,
          id: item.id,
        });
        if (matches.length >= 100) break;
      }
      if (matches.length >= 100) break;
    }
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    // One piece of text may match multiple watchlist entries. Remove it only once.
    const distinct = [];
    for (const match of matches) {
      if (!distinct.length || match.start >= distinct[distinct.length - 1].end)
        distinct.push(match);
    }
    return distinct;
  };

  Pop.removeMatches = function (text, matches) {
    for (const match of [...matches].sort((a, b) => b.start - a.start)) {
      text = text.slice(0, match.start) + text.slice(match.end);
    }
    return text;
  };

  Pop.cleanAddress = function (address) {
    try {
      const url = new URL(address);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.origin + url.pathname;
    } catch {
      return "";
    }
  };

  Pop.analyzeLink = function (label, address) {
    let url;
    try {
      url = new URL(address);
    } catch {
      return ["Enter a complete HTTP or HTTPS address."];
    }
    if (!["http:", "https:"].includes(url.protocol))
      return ["Only HTTP and HTTPS links are supported."];
    const findings = [];
    let labelHost = "";
    try {
      labelHost = new URL(label.startsWith("http") ? label : "https://" + label)
        .hostname;
    } catch {}
    if (
      labelHost.includes(".") &&
      labelHost.replace(/^www\./, "") !== url.hostname.replace(/^www\./, "")
    )
      findings.push(
        "Label: " +
          labelHost +
          ". Actual destination: " +
          url.hostname +
          ". These differ.",
      );
    if (url.protocol === "http:")
      findings.push(
        "HTTP is unencrypted. Avoid sharing sensitive information here.",
      );
    if (["bit.ly", "tinyurl.com", "t.co", "shorturl.at"].includes(url.hostname))
      findings.push(
        "This is a shortened link. The final destination has not been checked.",
      );
    if (url.hostname.includes("xn--"))
      findings.push(
        "An encoded international domain is present. Check the spelling; this alone is not evidence of fraud.",
      );
    if (url.username || url.password)
      findings.push(
        "Text before @ is not the destination. The hostname is " +
          url.hostname +
          ".",
      );
    if (!findings.length)
      findings.push(
        "No supported warning found. This does not establish safety.",
      );
    return [...findings, "Pop has not visited this destination."];
  };
})();
