import React, { useEffect, useRef, useState } from "react";
const colors: any = {
  blocked: "#8b0000",
  high: "#8b0000",
  caution: "#6b4300",
  unverified: "#333",
};
export function ResultLink({
  url,
  assessment,
  exposure,
  label = "Review source ↗",
}: any) {
  const level = assessment?.level || "unverified";
  let allowed = false;
  try {
    const u = new URL(url);
    allowed =
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      assessment?.openAllowed !== false;
  } catch {}
  const link = allowed ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : null;
  return (
    <div
      style={{
        margin: "8px 0",
        borderLeft: `4px solid ${colors[level] || "#333"}`,
        paddingLeft: 9,
      }}
    >
      {exposure && (
        <p>
          <strong>{exposure.label}</strong>
          <br />
          <small>{exposure.reason}</small>
        </p>
      )}
      <strong style={{ color: colors[level] || "#333" }}>
        {assessment?.label || "Link not assessed"}
      </strong>
      {assessment?.hostname && (
        <p style={{ overflowWrap: "anywhere" }}>
          Destination: <code>{assessment.hostname}</code>
        </p>
      )}
      {assessment?.unicodeHostname !== assessment?.hostname && (
        <p>
          Decoded spelling: <code>{assessment?.unicodeHostname}</code>
        </p>
      )}
      {!!assessment?.signals?.length && (
        <ul>
          {assessment.signals.map((s: any) => (
            <li key={s.code}>{s.message}</li>
          ))}
        </ul>
      )}
      {level === "high" && link ? (
        <details>
          <summary>Review warnings and reveal destination link</summary>
          {link}
        </details>
      ) : (
        link
      )}
      {!allowed && <p>This destination cannot be opened from this result.</p>}
      <small>
        URL signals only. Malware/phishing reputation has not been checked.
      </small>
    </div>
  );
}
export function RiskSummary({ summary }: any) {
  if (!summary) return null;
  return (
    <aside className="mini-note" aria-label="Result risk summary">
      <strong>Flags for your review</strong>
      <p>
        {summary.blockedLinks} blocked links · {summary.highConcernLinks}{" "}
        high-concern links · {summary.cautionLinks} caution links ·{" "}
        {summary.potentialSensitiveFindings} potentially sensitive findings.
      </p>
      <small>
        Exposure and destination risk are different. No warning is a safety
        guarantee; sources and threat feeds have not been visited.
      </small>
    </aside>
  );
}
export function LinkChecker({ enabled }: { enabled: boolean }) {
  const [url, setURL] = useState(""),
    [label, setLabel] = useState(""),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  useEffect(() => {
    const clear = () => {
      epoch.current++;
      setURL("");
      setLabel("");
      setResult(null);
      setBusy(false);
      setError("");
    };
    window.addEventListener("strikeout-auth-changed", clear);
    return () => {
      epoch.current++;
      window.removeEventListener("strikeout-auth-changed", clear);
    };
  }, []);
  async function assess(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled || busy) return;
    const current = epoch.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/osint/links/assess", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          links: [{ url, label }],
          consent: { selfOwned: true, version: "1" },
        }),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error || "Link review unavailable.");
      if (current === epoch.current) setResult(x.results[0].assessment);
    } catch (e: any) {
      if (current === epoch.current) setError(e.message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  return (
    <details className="step-card">
      <summary>Check a link before opening it</summary>
      <p>
        Checks URL structure on the Strikeout backend. The destination is not
        visited and the URL is not sent to an external reputation service.
      </p>
      {!enabled && <p>Sign in to use the link checker.</p>}
      <form onSubmit={assess}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
          <label>
            Destination URL
            <input
              required
              maxLength={4000}
              value={url}
              onChange={(e) => {
                setURL(e.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Displayed address, optional
            <input
              maxLength={500}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setResult(null);
              }}
              placeholder="https://example.org"
            />
          </label>
          <button disabled={!enabled || busy}>
            {busy ? "Reviewing…" : "Assess link"}
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite">
          <ResultLink
            url={url}
            assessment={result}
            label="Open reviewed destination ↗"
          />
        </div>
      )}
    </details>
  );
}
