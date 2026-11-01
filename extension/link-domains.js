// One local catalogue shared by blocking and the warning screen. No URL upload.
globalThis.PopLookalikes = (() => {
  const brands = [
    "instagram.com", "facebook.com", "google.com", "gmail.com",
    "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com",
    "icloud.com", "apple.com", "paypal.com", "microsoft.com",
    "amazon.com", "netflix.com", "discord.com", "github.com",
    "linkedin.com", "youtube.com", "whatsapp.com", "telegram.org",
    "snapchat.com", "reddit.com", "twitch.tv", "proton.me",
    "dropbox.com", "spotify.com",
  ];
  const targets = new Map();
  for (const domain of brands) {
    const dot = domain.indexOf(".");
    const word = domain.slice(0, dot), suffix = domain.slice(dot);
    const variants = new Set();
    for (let i = 0; i < word.length; i++) {
      variants.add(word.slice(0, i) + word[i] + word.slice(i));
      variants.add(word.slice(0, i) + word.slice(i + 1));
      if (i < word.length - 1)
        variants.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
      const digit = { o: "0", i: "1", l: "1" }[word[i]];
      if (digit) variants.add(word.slice(0, i) + digit + word.slice(i + 1));
    }
    for (const variant of variants) {
      const typo = variant + suffix;
      if (variant.length > 3 && !brands.includes(typo)) targets.set(typo, domain);
    }
  }
  function match(host) {
    host = String(host).toLowerCase().replace(/\.$/, "");
    for (const [typo, real] of targets)
      if (host === typo || host.endsWith("." + typo)) return real;
    return null;
  }
  return { brands, targets, match };
})();
