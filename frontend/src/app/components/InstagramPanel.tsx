import React, { useEffect, useState } from "react";

// Uses STRIKEOUT's existing session. Instagram credentials belong only in the operator's browser.
export function InstagramPanel() {
  const [status, setStatus] = useState<any>(null),
    [records, setRecords] = useState<any[]>([]),
    [operator, setOperator] = useState<any>(null);
  const [username, setUsername] = useState(""),
    [privacy, setPrivacy] = useState("public"),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [text, setText] = useState("");
  async function request(path: string, body?: any) {
    const r = await fetch("/api/instagram/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const x = await r.json();
    if (!r.ok) throw Error(x.error || "Instagram service unavailable");
    return x;
  }
  async function refresh() {
    const s = await request("status");
    setStatus(s);
    setRecords((await request("follow")).requests);
    if (s.operator) setOperator(await request("operator"));
  }
  useEffect(() => {
    refresh().catch(() => {});
    function clearAccount() {
      setStatus(null);
      setRecords([]);
      setOperator(null);
      setPreview("");
      setText("");
      setUsername("");
      setConsent(false);
      refresh().catch(() => {});
    }
    window.addEventListener("strikeout-auth-changed", clearAccount);
    return () => {
      window.removeEventListener("strikeout-auth-changed", clearAccount);
      if (preview) URL.revokeObjectURL(preview);
    };
  }, []);
  async function run(fn: () => Promise<any>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function view() {
    const r = await fetch("/api/instagram/bot/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) {
      const x = await r.json();
      throw Error(x.error);
    }
    const url = URL.createObjectURL(await r.blob());
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  }
  async function input(body: any) {
    await request("bot/input", body);
    await view();
  }
  return (
    <details className="instagram-panel">
      <summary>Instagram / Request Pop for my private account</summary>
      <p>
        Public-reference checks are below. This separate local service can
        request permission for <strong>@popyourproblemsaway</strong> to follow
        your private account. It does not import or scan your posts.
      </p>
      {!status && (
        <p>
          Sign into Cases &amp; Reports first, then{" "}
          <button onClick={() => run(refresh)}>Refresh Instagram access</button>
          .
        </p>
      )}
      {status && !status.local && (
        <p className="mini-note">
          The Instagram browser runs on the operator's computer. Open this
          service at localhost:3002 to request a follow. Public-reference checks
          below work independently.
        </p>
      )}
      {status?.local && (
        <>
          <label>
            My account is
            <select
              value={privacy}
              onChange={(e) => {
                setPrivacy(e.target.value);
                setConsent(false);
              }}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          {privacy === "private" && (
            <>
              <label>
                My Instagram username
                <input
                  value={username}
                  maxLength={30}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                This account is mine. I allow Pop's service account to send a
                follow request.
              </label>
              <button
                disabled={busy || !consent || !username.trim()}
                onClick={() =>
                  run(async () => {
                    await request("follow", {
                      username,
                      accountPrivacy: "private",
                      consent: true,
                    });
                  })
                }
              >
                Request Pop follow
              </button>
            </>
          )}
          {privacy === "public" && (
            <p>
              Public accounts can use the profile reference check below. No
              follow request is needed.
            </p>
          )}
          {records.map((r) => (
            <article className="step-card" key={r.id}>
              <strong>@{r.owner}</strong>
              <p>Status: {r.status.replaceAll("_", " ")}</p>
              {r.status !== "withdrawn" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => request("follow/" + r.id + "/withdraw", {}))
                  }
                >
                  Withdraw permission
                </button>
              )}
            </article>
          ))}
          <small>
            Queued means waiting for the operator. Withdraw stops future service
            actions; remove the service account in Instagram yourself if a
            follow was already sent.
          </small>
        </>
      )}
      {status?.operator && status.local && (
        <details>
          <summary>Operator controls / service account only</summary>
          <p>
            Sign into Instagram as @popyourproblemsaway. These controls are
            restricted to configured STRIKEOUT operator usernames on this
            computer. Instagram may require CAPTCHA or verification.
          </p>
          <div className="toolbar">
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request("bot/connect", {});
                  await view();
                })
              }
            >
              Open Instagram sign-in
            </button>
            <button disabled={busy} onClick={() => run(view)}>
              Refresh preview
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request("bot/close", {});
                  setPreview("");
                })
              }
            >
              Close browser
            </button>
          </div>
          {preview && (
            <>
              <img
                src={preview}
                alt="Local Instagram operator browser. Click a field, then use the text controls below."
                style={{
                  maxWidth: "100%",
                  width: 480,
                  border: "2px inset #fff",
                  cursor: "crosshair",
                }}
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - box.left) * 480) / box.width,
                    y = ((e.clientY - box.top) * 650) / box.height;
                  run(() => input({ kind: "click", x, y }));
                }}
              />
              <label>
                Type into selected Instagram field
                <input
                  type="password"
                  value={text}
                  autoComplete="off"
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <div className="toolbar">
                <button
                  disabled={busy || !text}
                  onClick={() => {
                    const value = text;
                    setText("");
                    run(() => input({ kind: "text", text: value }));
                  }}
                >
                  Type text
                </button>
                {["Tab", "Enter", "Backspace"].map((key) => (
                  <button
                    key={key}
                    disabled={busy}
                    onClick={() => run(() => input({ kind: "key", key }))}
                  >
                    {key}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => input({ kind: "scroll", direction: "down" }))
                  }
                >
                  Scroll down
                </button>
              </div>
            </>
          )}
          {(operator?.requests || []).map((r: any) => (
            <article className="step-card" key={r.id}>
              <strong>
                @{r.owner}: {r.status}
              </strong>
              {r.lastError && <p>{r.lastError}</p>}
              {r.status === "queued" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => request("bot/process", { requestId: r.id }))
                  }
                >
                  Process consented request
                </button>
              )}
            </article>
          ))}
        </details>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
