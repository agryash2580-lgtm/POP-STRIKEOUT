import React, { useEffect, useState } from "react";
export function PopEvidenceLibrary({ caseId, cases = [], onAttached }: any) {
  const [items, setItems] = useState<any[]>([]),
    [target, setTarget] = useState(caseId || ""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function call(path = "", method = "GET", body?: any) {
    const r = await fetch("/api/library" + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const x = await r.json();
    if (!r.ok) throw Error(x.error || "Evidence request failed.");
    return x;
  }
  async function load() {
    setItems((await call()).items);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const refresh = () => load().catch(() => {});
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => setTarget(caseId || ""), [caseId]);
  async function run(id: string, fn: () => Promise<any>) {
    if (busy) return;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <h2>Pop evidence library</h2>
      <p>
        Captures you explicitly synced from the paired extension. Add one to a
        case to select it for reports. HTML and image redactions are separate.
      </p>
      <button disabled={!!busy} onClick={() => run("refresh", load)}>
        Refresh synced captures
      </button>
      {!caseId && (
        <label>
          Add evidence to
          <select aria-label="Add evidence to" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a case</option>
            {cases.map((c: any) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      {!items.length && (
        <p>
          No synced captures yet. Pair Pop in Delivery &amp; Pop, then capture
          and sync evidence from the extension.
        </p>
      )}
      {items.map((item) => (
        <article key={item.id} className="step-card">
          <strong>{item.name}</strong>
          <p>{item.address}</p>
          <small>
            Captured {item.capturedAt} · Server received {item.receivedAt}
          </small>
          <p>{item.note}</p>
          <details>
            <summary>Integrity hashes</summary>
            <p>
              Screenshot SHA-256: <code>{item.imageHash}</code>
            </p>
            {item.htmlHash && (
              <p>
                HTML SHA-256: <code>{item.htmlHash}</code>
              </p>
            )}
            <small>
              Hashes help compare files later; they do not prove authenticity or
              legal admissibility.
            </small>
          </details>
          <div className="toolbar">
            <button
              disabled={!target || !!busy}
              onClick={() =>
                run(item.id, async () => {
                  await call("/" + item.id + "/attach", "POST", {
                    caseId: target,
                  });
                  setNotice(
                    "Attached to the case. It is now selectable for the report.",
                  );
                  await onAttached?.(target);
                })
              }
            >
              Add to case
            </button>
            <a href={"/api/library/" + item.id + "/image"}>Screenshot</a>
            {item.hasHTML && (
              <a href={"/api/library/" + item.id + "/html"}>HTML snapshot</a>
            )}
            <a href={"/api/library/" + item.id + "/manifest"}>Manifest</a>
            <button
              disabled={!!busy}
              onClick={() =>
                run(item.id, async () => {
                  const r = await call("/" + item.id + "/email", "POST", {});
                  setNotice(
                    "Email service accepted the evidence bundle. Inbox delivery is not yet confirmed.",
                  );
                })
              }
            >
              Email verified address
            </button>
            <button
              disabled={!!busy}
              onClick={() =>
                run(item.id, async () => {
                  if (
                    !confirm(
                      "Delete this library capture? Copies attached to cases and downloaded files remain.",
                    )
                  )
                    return;
                  await call("/" + item.id, "DELETE");
                  await load();
                })
              }
            >
              Delete library copy
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
