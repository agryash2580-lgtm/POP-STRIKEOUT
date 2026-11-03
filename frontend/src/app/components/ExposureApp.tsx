import { ExposureAuthenticatorGate } from "./ExposureAuthenticatorGate";
import { ResultLink, RiskSummary, LinkChecker, FindingGuidance, SourceCoverage } from "./LinkRisk";
import { AdvancedExposure } from "./AdvancedExposure";
import React, { useEffect, useRef, useState } from "react";
import { InstagramPanel } from "./InstagramPanel";
import { requestJSON } from "../../../../shared/http-client.js";
export function IconExposure({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="2" y="3" width="25" height="22" fill="#c0c0c0" stroke="#000" />
      <rect x="4" y="5" width="21" height="4" fill="#000080" />
      <circle
        cx="14"
        cy="17"
        r="6"
        fill="#fff"
        stroke="#008080"
        strokeWidth="3"
      />
      <path d="m19 22 9 8" stroke="#000" strokeWidth="4" />
    </svg>
  );
}
export function ExposureApp() {
  return (
    <>
      <section className="mini-note" aria-label="Exposure demonstration">
        <p>New to StrikeOut? Explore fictional exposure findings and practical privacy steps without entering personal information.</p>
        <a href="/devfest.html">Try the fictional exposure demo — no sign-in required</a>
      </section>
      <ExposureAuthenticatorGate>
        <ExposureTools />
      </ExposureAuthenticatorGate>
    </>
  );
}
function ExposureTools() {
  const generation = useRef(0);
  const [service, setService] = useState("email"),
    [value, setValue] = useState(""),
    [name, setName] = useState(""),
    [employer, setEmployer] = useState(""),
    [documentText, setDocumentText] = useState(""),
    [source, setSource] = useState(""),
    [consent, setConsent] = useState(false),
    [webEnabled, setWebEnabled] = useState(true),
    [caps, setCaps] = useState<any>(null),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (location.hash.startsWith("#pop-review=")) {
      try {
        const encoded = location.hash.slice(12);
        if (encoded.length > 70000)
          throw Error("This page handoff is too large.");
        const value = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
          ),
        );
        if (typeof value.text !== "string" || value.text.length > 12000)
          throw Error("Invalid page handoff.");
        const url = new URL(value.sourceUrl);
        if (!["http:", "https:"].includes(url.protocol))
          throw Error("Invalid source address.");
        setService("documents");
        setDocumentText(value.text);
        setSource(url.href);
        setConsent(false);
      } catch (e: any) {
        setError(e.message);
      }
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, []);
  useEffect(() => {
    function clearAccount() {
      generation.current++;
      setBusy(false);
      setResult(null);
      setValue("");
      setDocumentText("");
      setName("");
      setEmployer("");
      setConsent(false);
      setCaps(null);
      setError("");
      loadCapabilities();
    }
    window.addEventListener("strikeout-auth-changed", clearAccount);
    function loadCapabilities() {
      const version = generation.current;
      requestJSON("/api/osint/capabilities")
        .then((x) => { if (version === generation.current) setCaps(x); })
        .catch((e) => { if (version === generation.current) setError(e.message); });
    }
    loadCapabilities();
    return () => {
      generation.current++;
      window.removeEventListener("strikeout-auth-changed", clearAccount);
    };
  }, []);
  async function post(path: string, body: any) {
    const version = generation.current;
    const data = await requestJSON("/api/osint" + path, {
      method: "POST",
      body, timeoutMs: 100000,
    });
    if (version !== generation.current) throw new DOMException("Superseded check", "AbortError");
    return data;
  }
  async function scan(e: any) {
    e.preventDefault();
    if (busy) return;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (service === "documents") {
        const identifiers: any = {};
        if (value.trim())
          identifiers.emails = value
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (name.trim())
          identifiers.names = name
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
        const data = await post("/review-documents", {
          identifiers,
          documents: [
            { text: documentText, ...(source ? { sourceUrl: source } : {}) },
          ],
          consent: { selfOwned: true, version: "1", providers: [] },
        });
        setResult(data);
        return;
      }
      if (service === "password") {
        const bytes = await crypto.subtle.digest(
          "SHA-1",
          new TextEncoder().encode(value),
        );
        const digest = Array.from(new Uint8Array(bytes))
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();
        if (version !== generation.current) return;
        setValue("");
        const data = await post("/passwords/range", {
          prefix: digest.slice(0, 5),
          consent: {
            selfOwned: true,
            version: "1",
            providers: ["pwned_passwords"],
          },
        });
        const match = data.range
          .split(/\r?\n/)
          .find((x: string) => x.split(":")[0] === digest.slice(5));
        setResult({ password: true, count: Number(match?.split(":")[1] || 0) });
        return;
      }
      const input =
        service === "instagram"
          ? { username: value }
          : service === "email"
            ? { email: value }
            : service === "phone"
              ? { phone: value }
              : service === "identity_cards"
                ? { fullName: name, ...(employer ? { employer } : {}) }
                : { profileUrl: value, ...(name ? { fullName: name } : {}) };
      const providers = ["github_public"];
      if (webEnabled)
        for (const engine of ["google", "bing", "duckduckgo"]) {
          if (caps?.providers?.["serpapi_" + engine])
            providers.push("serpapi_" + engine);
        }
      if (caps?.providers?.brave) providers.push("brave");
      if (service === "email" && caps?.providers?.hibp) providers.push("hibp");
      setResult(
        await post("/check", {
          service,
          input,
          consent: { selfOwned: true, version: "1", providers },
        }),
      );
    } catch (e: any) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">REVERSE OSINT / YOUR OWN INFORMATION</span>
      <h1>See what is exposed.</h1>
      <p>
        Real checks from the integrated OSINT backend. Review possible matches
        before drawing conclusions.
      </p>
      <div className="mini-note">
        <strong>No-key checks are available.</strong>
        <p>
          Public-reference searches combine Google, Bing and DuckDuckGo when
          configured, plus GitHub issues and pull requests. No search covers the
          whole web. Document review inspects only text you supply. Password
          checks use a five-character hash prefix.
        </p>
        {caps && (
          <small>
            GitHub public search: enabled · Document review: enabled · Brave
            web search:{" "}
            {caps.providers?.brave ? "configured" : "not configured"} · HIBP
            email breaches:{" "}
            {caps.providers?.hibp ? "configured" : "not configured"}
          </small>
        )}
      </div>
      <LinkChecker enabled={!!caps} />
      <InstagramPanel />
      <AdvancedExposure capabilities={caps} />
      {service === "instagram" && (
        <div className="mini-note">
          <strong>Want to review your actual Instagram profile?</strong>
          <p>
            Open your own profile while signed into Instagram. In Pop's
            extension toolbar, expand More and choose Review visible text on
            STRIKEOUT. Review the imported text here and enter the identifiers
            you want to find. This also works on private pages you can access;
            it does not make them publicly exposed.
          </p>
          {/^[a-zA-Z0-9._]{1,30}$/.test(value.replace(/^@/, "")) && (
            <a
              href={
                "https://www.instagram.com/" + value.replace(/^@/, "") + "/"
              }
              target="_blank"
              rel="noreferrer"
            >
              Open my Instagram profile
            </a>
          )}
        </div>
      )}
      <form id="tour-exposure-search-well" onSubmit={scan}>
        <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
        {caps?.providers?.serpapi &&
          !["documents", "password"].includes(service) && (
            <label className="check">
              <input
                type="checkbox"
                checked={webEnabled}
                onChange={(e) => {
                  setWebEnabled(e.target.checked);
                  setConsent(false);
                }}
              />
              Search Google, Bing and DuckDuckGo through SerpApi (up to six
              searches). Results may overlap; private content is excluded.
            </label>
          )}
        <label>
          Check type
          <select
            value={service}
            onChange={(e) => {
              generation.current++;
              setBusy(false);
              setService(e.target.value);
              setValue("");
              setName("");
              setResult(null);
              setError("");
              setConsent(false);
            }}
          >
            <option value="instagram" disabled>
              Instagram references (ownership verification required)
            </option>
            <option value="email">Email public references</option>
            <option value="phone" disabled>
              Phone references (ownership verification required)
            </option>
            <option value="linkedin">LinkedIn public references</option>
            <option value="identity_cards">
              Own-name identity-document references
            </option>
            <option value="documents">Review my document text</option>
            <option value="password">
              Password breach check (prefix only)
            </option>
          </select>
        </label>
        {service !== "identity_cards" && (
          <label>
            {service === "instagram"
              ? "Your Instagram username (without a URL)"
              : service === "password"
                ? "Password to check locally"
                : service === "phone"
                  ? "Your international phone number (+countrycode)"
                  : service === "linkedin"
                    ? "Your LinkedIn /in/ profile URL"
                    : service === "documents"
                      ? "Your emails to find, optional (comma-separated)"
                      : "Your email address"}
            <input
              type={service === "password" ? "password" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required={service !== "documents"}
              autoComplete="off"
              maxLength={service === "documents" ? 1000 : 254}
            />
          </label>
        )}
        {["linkedin", "identity_cards", "documents"].includes(service) && (
          <label>
            {service === "documents"
              ? "Your names to find, optional (comma-separated)"
              : "Your own full name" +
                (service === "linkedin" ? " (optional)" : "")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={service === "identity_cards"}
              maxLength={service === "documents" ? 800 : 80}
            />
          </label>
        )}
        {service === "identity_cards" && (
          <label>
            Employer, optional
            <input
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              maxLength={80}
            />
          </label>
        )}
        {service === "documents" && (
          <>
            <label>
              Paste text from your own document
              <textarea
                aria-label="Document text"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                required
                rows={7}
                maxLength={100000}
              />
            </label>
            <label>
              Or load a document (.pdf, .txt, .md, .csv or .json)
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setError("");
                    const version = generation.current;
                    const { documentText: extractDocumentText } = await import("../document-text");
                    const extracted = await extractDocumentText(f);
                    if (version === generation.current) setDocumentText(extracted);
                  } catch (error: any) {
                    setError(error.message);
                  }
                }}
              />
            </label>
            <label>
              Source URL label, optional (not fetched)
              <input
                type="url"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <p className="mini-note">
              The server reviews supplied text for your identifiers,
              credential-like assignments, card-like patterns and
              identity-document terms. Sensitive snippets are masked. This does
              not crawl websites or run OCR.
            </p>
          </>
        )}
        {service === "password" ? (
          <p className="mini-note">
            The browser hashes this locally. Only the first five SHA-1
            characters go to STRIKEOUT and Pwned Passwords. The remaining hash
            is compared here. Never enter your STRIKEOUT password.
          </p>
        ) : (
          service !== "documents" && (
            <p className="mini-note">
              This sends the supplied identifier to GitHub public search
              {webEnabled && caps?.providers?.serpapi
                ? ", and Google, Bing and DuckDuckGo through SerpApi"
                : ""}
              {caps?.providers?.brave ? ", Brave Search" : ""}
              {service === "email" && caps?.providers?.hibp
                ? " and Have I Been Pwned"
                : ""}
              . Private accounts are not accessed.
            </p>
          )
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          This is my information and I approve the described check.
        </label>
        <button disabled={!consent || busy}>
          {busy ? "Checking…" : "Check my exposure"}
        </button>
        </fieldset>
      </form>
      {error && (
        <div className="error" role="alert">
          {error}
          {!caps && (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("strikeout-open", {
                    detail: { section: "cases" },
                  }),
                )
              }
            >
              Open sign-in / Cases
            </button>
          )}
        </div>
      )}
      {result?.password && (
        <div className="answer">
          <h2>
            {result.count
              ? "Found in breached-password data"
              : "Not found in this check"}
          </h2>
          <p>
            {result.count
              ? "The provider reports " +
                result.count.toLocaleString() +
                " occurrences. Replace this password wherever you use it."
              : "This does not prove a password is strong, private or safe to reuse."}
          </p>
        </div>
      )}
      {result && !result.password && (
        <>
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(result, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download =
                "strikeout-exposure-" +
                new Date().toISOString().slice(0, 10) +
                ".json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download exposure results
          </button>
          <h2>Exposure results</h2>
          <RiskSummary summary={result.riskSummary} />
          <SourceCoverage result={result} />
          <p>Downloaded results can contain identifying links or text. Keep the file private and remove it from shared devices after use.</p>
          {result.status === "incomplete" && (
            <button
              disabled={busy}
              onClick={() => scan({ preventDefault() {} })}
            >
              Retry exposure check
            </button>
          )}
          {(result.findings || []).map((f: any, i: number) => (
            <article className="step-card" key={f.id || i}>
              <strong>
                {f.title ||
                  f.name ||
                  String(f.category || "Finding").replaceAll("_", " ")}
              </strong>
              <p>{f.snippet || f.evidence || f.dataClasses?.join(", ")}</p>
              {f.priorityReason && (
                <p><strong>{f.severity ? f.severity.charAt(0).toUpperCase() + f.severity.slice(1) : "Review"}</strong></p>
              )}
              {f.providers?.length > 0 && (
                <small>Found by: {f.providers.join(", ")}</small>
              )}
              {(f.url || f.source) && (
                <ResultLink
                  url={f.url || f.source}
                  assessment={f.linkAssessment}
                  exposure={f.exposureAssessment}
                />
              )}
              {!(f.url || f.source) && f.exposureAssessment && (
                <p>
                  <strong>{f.exposureAssessment.label}</strong>
                  <br />
                  <small>{f.exposureAssessment.reason}</small>
                </p>
              )}
              {f.line && (
                <small>
                  Document {f.document}, line {f.line}.{" "}
                </small>
              )}
              <FindingGuidance finding={f} />
            </article>
          ))}
        </>
      )}
    </>
  );
}
