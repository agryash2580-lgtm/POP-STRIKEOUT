import React, { useState } from "react";
function bridge(action: string, value?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener("message", listen);
      reject(Error("Install Pop 2.2.0, refresh this page and try again."));
    }, 12000);
    function listen(e: MessageEvent) {
      if (
        e.source !== window ||
        e.origin !== location.origin ||
        e.data?.type !== "POP_SETTINGS_RESULT" ||
        e.data.id !== id
      )
        return;
      clearTimeout(timeout);
      window.removeEventListener("message", listen);
      e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result);
    }
    window.addEventListener("message", listen);
    window.postMessage(
      { type: "STRIKEOUT_POP_SETTINGS", id, action, value },
      location.origin,
    );
  });
}
export function ExtensionSettings() {
  const [prefs, setPrefs] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState("email"),
    [value, setValue] = useState(""),
    [message, setMessage] = useState("");
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Pop extension settings</h2>
      <p>
        These controls update the installed extension on this browser. Your chat
        token and screenshots are never exposed to this page.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <button
        disabled={busy}
        onClick={() => run(async () => setPrefs(await bridge("get")))}
      >
        {prefs ? "Refresh Pop settings" : "Connect installed Pop"}
      </button>
      {prefs && (
        <>
          <p>
            Pop 2.2.0 /{" "}
            {prefs.paired ? "AI connection paired" : "AI connection not paired"}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.sharingGuard}
              onChange={(e) =>
                setPrefs({ ...prefs, sharingGuard: e.target.checked })
              }
            />
            Warn after pasting watched information
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.aiConsent}
              onChange={(e) =>
                setPrefs({ ...prefs, aiConsent: e.target.checked })
              }
            />
            Enable optional AI chat: typed messages and deliberately included
            context go to STRIKEOUT and Gemini
          </label>
          <h3>Your local watchlist</h3>
          <div className="toolbar">
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await bridge("allow-ai");
                  setMessage(
                    "Finish the browser permission prompt in the new tab, then refresh these settings.",
                  );
                })
              }
            >
              Grant browser AI permission
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await bridge("disconnect");
                  setPrefs({ ...prefs, paired: false, aiConsent: false });
                  setMessage(
                    "Disconnected Pop AI. Local tools remain available.",
                  );
                })
              }
            >
              Disconnect Pop AI
            </button>
          </div>
          {prefs.watchlist.map((x: any) => (
            <p key={x.id}>
              {x.kind}: {x.value}{" "}
              <button
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    watchlist: prefs.watchlist.filter(
                      (p: any) => p.id !== x.id,
                    ),
                  })
                }
              >
                Remove
              </button>
            </p>
          ))}
          <div className="two-col">
            <label>
              Identifier type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="username">Username</option>
              </select>
            </label>
            <label>
              Identifier
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={150}
              />
            </label>
          </div>
          <button
            disabled={!value.trim()}
            onClick={() => {
              const identifier = value.trim();
              if (prefs.watchlist.length >= 30) {
                setError("Keep the watchlist to 30 identifiers.");
                return;
              }
              if (
                kind === "email" &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
              ) {
                setError("Enter a complete email address.");
                return;
              }
              if (
                kind === "phone" &&
                (!/^\+?[\d\s().-]+$/.test(identifier) ||
                  !/^\d{7,15}$/.test(identifier.replace(/\D/g, "")))
              ) {
                setError("Use a phone number with 7–15 digits.");
                return;
              }
              if (
                kind === "username" &&
                !/^@?[\p{L}\p{N}_.-]{3,64}$/u.test(identifier)
              ) {
                setError(
                  "Use a username of 3–64 letters, digits, dots, dashes or underscores.",
                );
                return;
              }
              if (
                prefs.watchlist.some(
                  (x: any) =>
                    x.kind === kind &&
                    x.value.toLowerCase() === identifier.toLowerCase(),
                )
              ) {
                setError("That identifier is already watched.");
                return;
              }
              setError("");
              setPrefs({
                ...prefs,
                watchlist: [
                  ...prefs.watchlist,
                  { id: crypto.randomUUID(), kind, value: value.trim() },
                ],
              });
              setValue("");
            }}
          >
            Add identifier
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await bridge("save", prefs);
                setMessage("Saved to this browser’s Pop extension.");
              })
            }
          >
            Save Pop preferences
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await fetch("/api/pop/connect-code", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                const x = await r.json();
                if (!r.ok) throw Error(x.error);
                await bridge("pair", { code: x.code });
                setPrefs({ ...prefs, paired: true });
                setMessage("Pop is paired with this website.");
              })
            }
          >
            Pair Pop AI with my account
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await bridge("wake");
                setMessage("Pop re-enabled on permitted sites.");
              })
            }
          >
            Wake Pop & clear disabled sites
          </button>
        </>
      )}
    </section>
  );
}
