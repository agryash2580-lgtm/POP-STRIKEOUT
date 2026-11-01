const api = globalThis.browser || globalThis.chrome;
let destination;
try {
  destination = new URL(decodeURIComponent(location.hash.slice(1)));
  if (!["http:", "https:"].includes(destination.protocol))
    throw Error("Invalid destination");
} catch {
  document.getElementById("status").textContent =
    "This warning has no valid destination.";
  document.getElementById("continue").disabled = true;
}
if (destination) {
  document.getElementById("destination").textContent = destination.hostname;
  document.getElementById("reason").textContent =
    "Check the full hostname before proceeding.";
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
  const word = destination.hostname.replace(/^www\./, "").split(".")[0];
  const suggestion = brands.find((real) => {
    const name = real.split(".")[0];
    return (
      word.slice(0, 3) === name.slice(0, 3) || word.slice(-4) === name.slice(-4)
    );
  });
  if (suggestion) {
    document.getElementById("safe").href = "https://" + suggestion + "/";
    document.getElementById("safe").textContent = "Open " + suggestion;
  } else document.getElementById("safe").hidden = true;
}
document.getElementById("back").onclick = () =>
  history.length > 1
    ? history.back()
    : location.replace("https://strikeout-mu20.vercel.app");
document.getElementById("continue").onclick = async () => {
  const result = await api.runtime.sendMessage({
    type: "POP_LINK_CONTINUE",
    address: destination.href,
  });
  if (result?.error)
    document.getElementById("status").textContent = result.error;
};
