import { SpecialistBots } from "./SpecialistBots";
import { AccountSecurity, MFAChallenge } from "./AccountSecurity";
import React, { useEffect, useRef, useState } from "react";
import {
  createReportingClient,
  evidenceFile,
  parsePopHandoff,
} from "../../../../shared/reporting-client.js";
import { createReportsClient } from "../../../../shared/reports-client.js";
import "./recovery.css";
import { ExtensionSettings } from "./ExtensionSettings";
import { PopEvidenceLibrary } from "./PopEvidenceLibrary";

const casesAPI = createReportingClient();
const reportsAPI = createReportsClient();
const BusyContext = React.createContext(false);
async function api(path: string, method = "GET", body?: any) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Request failed.");
  return value;
}
const blank = {
  title: "",
  category: "account_takeover",
  platform: "Instagram",
  description: "",
  occurredOn: "",
  profile: "",
  requestedOutcome: "",
};
const labels: any = {
  account_takeover: "Account takeover",
  impersonation: "Impersonation",
  financial_fraud: "Financial fraud",
  harassment: "Harassment",
  exposure: "Exposed information",
  other: "Something else",
};
function B({ children, onClick, type = "button", ...rest }: any) {
  const waiting = React.useContext(BusyContext);
  return (
    <button
      type={type}
      onClick={onClick}
      {...rest}
      disabled={waiting || rest.disabled}
    >
      {children}
    </button>
  );
}
export function IconCases({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M3 7h11l3 4h12v18H3z" fill="#e2b749" stroke="#151515" />
      <path d="M7 3h17v21H7z" fill="#ffffe5" stroke="#111" />
      <path d="M10 8h11M10 12h11M10 16h8" stroke="#008080" strokeWidth="2" />
      <path d="M3 15h26l-3 14H3z" fill="#efc65b" stroke="#111" />
    </svg>
  );
}
export function RecoveryApp() {
  const [mfaPending, setMfaPending] = useState(false);
  useEffect(() => {
    fetch("/api/auth/mfa/pending")
      .then((r) => r.json())
      .then((x) => setMfaPending(x.pending === true))
      .catch(() => {});
  }, []);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((x) => setGoogleAvailable(x.google === true))
      .catch(() => {});
  }, []);
  const [owner, setOwner] = useState<any>(null),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState("login");
  const [items, setItems] = useState<any[]>([]),
    [current, setCurrent] = useState<any>(null),
    [tab, setTab] = useState(
      location.search.includes("pop-settings") ? "settings" : "home",
    );
  const [form, setForm] = useState<any>(blank),
    [job, setJob] = useState<any>(null),
    [versions, setVersions] = useState<any[]>([]),
    [progress, setProgress] = useState<any[]>([]),
    [messages, setMessages] = useState<any[]>([]);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [approved, setApproved] = useState(false),
    [includeFiles, setIncludeFiles] = useState(false),
    [emailReport, setEmailReport] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<any>(null),
    [email, setEmail] = useState<any>({ verified: false }),
    [caps, setCaps] = useState<any>({}),
    [code, setCode] = useState("");
  const [pair, setPair] = useState(""),
    [stepNote, setStepNote] = useState("");
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("strikeout-case-context", {
        detail: current
          ? {
              caseId: current.id,
              title: current.title,
              reportId: job?.id,
              stale: job?.stale,
            }
          : null,
      }),
    );
  }, [current?.id, job?.id, job?.stale]);
  const running = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    api("/api/auth/me")
      .then(async (x) => {
        setOwner(x.user);
        if (x.user) await reload();
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    const h = parsePopHandoff(location.hash);
    if (h) {
      setForm({ ...blank, ...h });
      setTab("new");
      setNotice(
        "Pop prefilled this draft. Review it before saving. The screenshot must be attached separately.",
      );
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  useEffect(() => {
    const listener = (event: any) => {
      if (event.detail?.section === "settings") setTab("settings");
      if (event.detail?.section === "new") navigate("new");
      if (event.detail?.section === "cases") setTab("home");
      if (event.detail?.section === "services") setTab("services");
      if (event.detail?.draft) {
        navigate("new");
        setForm({ ...blank, ...event.detail.draft });
        setNotice(
          "Fictional tutorial draft. Review before saving; no screenshot has been attached.",
        );
      }
    };
    window.addEventListener("strikeout-workspace", listener);
    return () => window.removeEventListener("strikeout-workspace", listener);
  }, []);
  async function run(label: string, fn: () => Promise<any>) {
    if (running.current) return;
    running.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e: any) {
      if (live.current) setError(e.message);
    } finally {
      running.current = false;
      if (live.current) setBusy("");
    }
  }
  async function reload() {
    const x = await casesAPI.listCases();
    setItems(x.cases);
    const [c, e] = await Promise.all([
      reportsAPI.capabilities(),
      reportsAPI.emailStatus(),
    ]);
    setCaps(c);
    setEmail(e);
    return x;
  }
  async function openCase(id: string, section = "story") {
    const x = await casesAPI.getCase(id);
    setCurrent(x.case);
    setForm({ ...blank, ...x.case });
    setTab(section);
    setSelected(x.case.evidence.map((e: any) => e.id));
    setApproved(false);
    setAnswer(null);
    await loadReports(id);
  }
  async function loadReports(id: string) {
    const x = await reportsAPI.list(id);
    setVersions(x.reports);
    setJob(x.reports.at(-1) || null);
    setProgress(x.completedSteps);
    setMessages(x.messages);
  }
  async function resume(report: any) {
    setJob(report);
    setTab("report");
    const final = await reportsAPI.finish(report.id, (next: any) => {
      if (live.current) setJob(next);
    });
    if (live.current) {
      setJob(final);
      await loadReports(final.caseId);
    }
    return final;
  }
  function navigate(next: string) {
    setError("");
    setNotice("");
    setTab(next);
    if (next === "new") {
      setCurrent(null);
      setForm(blank);
      setJob(null);
      setVersions([]);
      setProgress([]);
      setMessages([]);
      setAnswer(null);
      setQuestion("");
      setSelected([]);
      setIncludeFiles(false);
      setEmailReport(false);
      setApproved(false);
    }
  }
  const field = (key: string, label: string, multiline = false) => (
    <label>
      {label}
      {multiline ? (
        <textarea
          name={key}
          rows={key === "description" ? 5 : 3}
          value={form[key] || ""}
          required={key === "description"}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          name={key}
          type={key === "occurredOn" ? "date" : "text"}
          value={form[key] || ""}
          required={key === "title"}
          maxLength={key === "title" ? 120 : 2000}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </label>
  );
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run("Opening your workspace", async () => {
      const x = await api("/api/auth/" + mode, "POST", {
        username: data.get("username"),
        password: data.get("password"),
      });
      if (x.mfaRequired) {
        setOwner(null);
        setMfaPending(true);
        return;
      }
      await reload();
      setOwner(x.user);
      window.dispatchEvent(new Event("strikeout-auth-changed"));
    });
  }
  function renderContent() {
    if (!ready)
      return (
        <div className="recovery">
          <p>Opening your private workspace...</p>
        </div>
      );
    if (mfaPending)
      return (
        <MFAChallenge
          onCancel={() => setMfaPending(false)}
          onComplete={async () => {
            const x = await api("/api/auth/me");
            await reload();
            setOwner(x.user);
            setMfaPending(false);
            window.dispatchEvent(new Event("strikeout-auth-changed"));
          }}
        />
      );
    if (!owner)
      return (
        <div className="recovery auth-screen">
          <div className="auth-copy">
            <span className="eyebrow">STRIKEOUT / RECOVERY DESK</span>
            <h1>
              Something happened.
              <br />
              Start here.
            </h1>
            <p>
              Your story, evidence and next step. One private workspace, with
              Pop for company.
            </p>
            <div className="mini-note">
              Case files stay private. Nothing is sent to a platform or
              authority automatically.
            </div>
          </div>
          <form onSubmit={authenticate}>
            <h2>
              {mode === "login" ? "Welcome back." : "Make your workspace."}
            </h2>
            {googleAvailable && (
              <>
                <a className="download-button" href="/api/auth/google/start">
                  Sign in with Google
                </a>
                <p>Or use your STRIKEOUT account below.</p>
              </>
            )}
            {location.search.includes("auth-error=") && (
              <p className="error">
                Google sign-in was cancelled, expired or unavailable. Try again
                or use your STRIKEOUT account.
              </p>
            )}
            <label>
              STRIKEOUT username
              <input
                name="username"
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                pattern="[A-Za-z0-9_-]+"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            <small>
              Use a new password of at least 10 characters. Never enter a
              social-account password.
            </small>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <B type="submit">
              {busy || (mode === "login" ? "Sign in" : "Create account")}
            </B>
            <B
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login"
                ? "New here? Create account"
                : "Already have an account?"}
            </B>
          </form>
        </div>
      );
    return (
      <div className="recovery">
        <header className="desk-bar">
          <span>
            <strong>RECOVERY DESK</strong>
            <small>{owner.username} / private workspace</small>
          </span>
          <div>
            <B onClick={() => run("Refreshing", reload)}>Refresh</B>
            <B
              onClick={() =>
                run("Signing out", async () => {
                  await api("/api/auth/logout", "POST", {});
                  window.dispatchEvent(new Event("strikeout-auth-changed"));
                  navigate("home");
                  setMessages([]);
                  setAnswer(null);
                  setVersions([]);
                  setProgress([]);
                  setSelected([]);
                  setForm(blank);
                  setOwner(null);
                  setMode("login");
                  setItems([]);
                  setCurrent(null);
                  setJob(null);
                })
              }
            >
              Sign out
            </B>
          </div>
        </header>
        <div className="desk-layout">
          <aside className="desk-nav">
            <B
              id="tour-cases-tab-mycases"
              aria-current={tab === "home" ? "page" : undefined}
              onClick={() => navigate("home")}
            >
              My cases <span>{items.length}</span>
            </B>
            <B id="tour-cases-tab-new" onClick={() => navigate("new")}>
              + New incident
            </B>
            {current && (
              <>
                <hr />
                <small className="case-name">{current.title}</small>
                {[
                  ["story", "Your story"],
                  ["evidence", "Evidence"],
                  ["report", "Report & PDF"],
                  ["help", "Next steps"],
                  ["complaint", "Complaint draft"],
                ].map(([key, label]) => (
                  <B
                    key={key}
                    aria-current={tab === key ? "page" : undefined}
                    onClick={() => navigate(key)}
                  >
                    {label}
                  </B>
                ))}
              </>
            )}
            <hr />
            <B
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("strikeout-open", {
                    detail: { section: "exposure" },
                  }),
                )
              }
            >
              Check exposure ↗
            </B>
            <B id="tour-cases-tab-help" onClick={() => navigate("services")}>
              Get help
            </B>
            <B onClick={() => navigate("settings")}>Delivery & Pop</B>
            <B onClick={() => navigate("security")}>Account security</B>
            <B onClick={() => navigate("library")}>Pop evidence</B>
            <p className="nav-bottom">
              Your call. Always.
              <br />
              Nothing filed automatically.
            </p>
          </aside>
          <main className="desk-main" aria-busy={!!busy}>
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={() => setError("")}>Dismiss</button>
              </div>
            )}
            {notice && (
              <div className="success" role="status">
                {notice}
              </div>
            )}
            {busy && (
              <div className="working" role="status">
                <span className="busy-dot" />
                {busy}
              </div>
            )}
            {tab === "security" && <AccountSecurity />}
            {tab === "library" && (
              <PopEvidenceLibrary
                cases={items}
                onAttached={async (id: string) => {
                  await reload();
                  await openCase(id, "evidence");
                }}
              />
            )}
            {tab === "home" && (
              <>
                <span className="eyebrow">A LITTLE LESS OVERWHELMING</span>
                <h1>A place to pick back up.</h1>
                <p>Keep the details together. Decide what happens next.</p>
                <B id="tour-cases-tab-new" onClick={() => navigate("new")}>
                  Log an incident →
                </B>
                <div className="case-grid">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      className="case-card"
                      onClick={() => run("Opening case", () => openCase(c.id))}
                    >
                      <small>
                        {labels[c.category] || c.kind || "Incident"}
                      </small>
                      <strong>{c.title}</strong>
                      <span>{c.description?.slice(0, 110)}</span>
                      <small>
                        {new Date(c.updatedAt || c.createdAt).toLocaleString()}
                      </small>
                    </button>
                  ))}
                </div>
                {!items.length && (
                  <div className="empty">
                    <IconCases size={48} />
                    <h2>A clean page.</h2>
                    <p>
                      Create your first case.
                    </p>
                  </div>
                )}
              </>
            )}
            {(tab === "new" || (tab === "story" && current)) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    current ? "Saving your story" : "Saving your incident",
                    async () => {
                      if (current) {
                        const x = await casesAPI.updateCase(current.id, form);
                        setCurrent(x.case);
                        await reload();
                        await loadReports(x.case.id);
                        setNotice("Saved. Earlier reports may need updating.");
                      } else {
                        const x = await casesAPI.createCase(form);
                        setCurrent(x.case);
                        setSelected([]);
                        await reload();
                        setTab("evidence");
                        setNotice(
                          "Case saved. Add evidence, or continue to your report.",
                        );
                      }
                    },
                  );
                }}
              >
                <span className="eyebrow">
                  {current ? "YOUR STORY" : "NEW CASE"}
                </span>
                <h1>Start with what you know.</h1>
                {field("title", "Give this incident a short title")}
                <div className="two-col">
                  <label>
                    What happened?
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      {Object.entries(labels).map(([id, label]: any) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Platform
                    <select
                      value={form.platform}
                      onChange={(e) =>
                        setForm({ ...form, platform: e.target.value })
                      }
                    >
                      {[
                        "Instagram",
                        "Facebook",
                        "Google",
                        "WhatsApp",
                        "Telegram",
                        "X",
                        "Microsoft",
                        "Other",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {field("description", "Describe what happened", true)}
                <div className="two-col">
                  {field("occurredOn", "Incident date, if known")}
                  {field("profile", "Relevant page/profile URL, optional")}
                </div>
                {field("requestedOutcome", "What help would you like?", true)}
                <p className="mini-note">
                  Do not include passwords, recovery codes or full bank-card
                  details. Saving this form does not send it to AI.
                </p>
                <B type="submit">
                  {current ? "Save changes" : "Save case & add evidence"}
                </B>
                {current && (
                  <B
                    onClick={() =>
                      run("Deleting case", async () => {
                        if (
                          !confirm(
                            "Delete this case, its evidence and reports? Downloaded copies remain.",
                          )
                        )
                          return;
                        await casesAPI.deleteCase(current.id);
                        setCurrent(null);
                        setJob(null);
                        setTab("home");
                        await reload();
                      })
                    }
                  >
                    Delete this case
                  </B>
                )}
              </form>
            )}
            {tab === "evidence" && current && (
              <>
                <span className="eyebrow">PRIVATE EVIDENCE</span>
                <h1>Keep the useful details.</h1>
                <p>
                  PNG, JPEG or PDF, up to 500 KB each. Synced Pop captures can
                  be attached directly below.
                </p>
                <PopEvidenceLibrary
                  caseId={current.id}
                  cases={items}
                  onAttached={async (id: string) => {
                    await reload();
                    await openCase(id, "evidence");
                  }}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formEl = e.currentTarget;
                    const data = new FormData(formEl);
                    run("Saving evidence", async () => {
                      const file = data.get("file") as File;
                      const x = await casesAPI.addEvidence(current.id, {
                        note: String(data.get("note")),
                        url: String(data.get("url") || ""),
                        ...(file?.size
                          ? { file: await evidenceFile(file) }
                          : {}),
                      });
                      setCurrent(x.case);
                      setSelected([...selected, x.case.evidence.at(-1).id]);
                      formEl.reset();
                      await reload();
                      await loadReports(x.case.id);
                      setApproved(false);
                    });
                  }}
                >
                  <label>
                    What does this evidence show?
                    <textarea name="note" required maxLength={3000} rows={2} />
                  </label>
                  <div className="two-col">
                    <label>
                      Source address, optional
                      <input name="url" type="url" />
                    </label>
                    <label>
                      Attach a file, optional
                      <input
                        name="file"
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                      />
                    </label>
                  </div>
                  <B type="submit">Add evidence</B>
                </form>
                <div className="evidence-list">
                  {current.evidence.map((e: any) => (
                    <article key={e.id}>
                      <strong>{e.file?.name || "Evidence note"}</strong>
                      <p>{e.note}</p>
                      {e.url && (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          Open source ↗
                        </a>
                      )}
                      {e.file && (
                        <a href={casesAPI.evidenceFileURL(current.id, e.id)}>
                          Download original
                        </a>
                      )}
                      <B
                        onClick={() =>
                          run("Removing evidence", async () => {
                            if (!confirm("Remove this item?")) return;
                            const x = await casesAPI.removeEvidence(
                              current.id,
                              e.id,
                            );
                            setCurrent(x.case);
                            setSelected(selected.filter((id) => id !== e.id));
                            await loadReports(x.case.id);
                            setApproved(false);
                          })
                        }
                      >
                        Remove
                      </B>
                    </article>
                  ))}
                </div>
                <B onClick={() => navigate("report")}>Continue to report →</B>
              </>
            )}
            {tab === "report" && current && (
              <>
                <span className="eyebrow">GEMINI / RESEARCH + REPORT</span>
                <h1>Your case. In context.</h1>
                {job?.research?.limitation && (
                  <p className="mini-note">{job.research.limitation}</p>
                )}
                <p className="mini-note">
                  If Gemini quota is unavailable, create a clearly labelled
                  local report. No AI or fresh research is used.
                </p>
                <B
                  onClick={() =>
                    run("Creating local report", async () => {
                      const x = await reportsAPI.offline(current.id, selected);
                      setJob(x);
                      await loadReports(current.id);
                    })
                  }
                >
                  Create local report & PDF (no AI)
                </B>
                <p>
                  General official guidance plus the facts you choose to share.
                  Review every generated report before using it.
                </p>
                <details>
                  <summary>
                    Add a synced Pop capture to this report's case
                  </summary>
                  <PopEvidenceLibrary
                    caseId={current.id}
                    cases={items}
                    onAttached={async (id: string) => {
                      await reload();
                      await openCase(id, "report");
                    }}
                  />
                </details>
                <details open={!job || job.stale}>
                  <summary>Review information and generate a report</summary>
                  <div className="mini-note">
                    <strong>Information to send:</strong>
                    <p>{current.description}</p>
                    <small>
                      Also included: title, category, platform, supplied dates,
                      relevant URLs, requested help and selected evidence notes.
                      Private text you put in those fields is included. Research
                      receives only a generic category/platform topic.
                    </small>
                  </div>
                  {current.evidence.map((e: any) => (
                    <label className="check" key={e.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(e.id)}
                        onChange={(ev) =>
                          setSelected(
                            ev.target.checked
                              ? [...selected, e.id]
                              : selected.filter((id) => id !== e.id),
                          )
                        }
                      />
                      {e.note.slice(0, 100)}
                      {e.file ? " (" + e.file.name + ")" : ""}
                    </label>
                  ))}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={includeFiles}
                      onChange={(e) => setIncludeFiles(e.target.checked)}
                    />
                    Also send selected screenshot/PDF file contents to Gemini
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                    />
                    I reviewed this context and approve sending it to Gemini for
                    research-assisted writing
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      disabled={!email.verified || !caps.emailConfigured}
                      checked={emailReport}
                      onChange={(e) => setEmailReport(e.target.checked)}
                    />
                    Email the finished PDF to my verified address{" "}
                    {email.verified
                      ? "(" + email.email + ")"
                      : "(verify in Delivery & Pop)"}
                  </label>
                  <B
                    disabled={!!busy || !approved}
                    onClick={() =>
                      run("Preparing your report", async () => {
                        const x = await reportsAPI.start(current.id, {
                          aiApproved: true,
                          evidenceIds: selected,
                          includeFiles,
                          emailReport,
                        });
                        await resume(x);
                      })
                    }
                  >
                    Generate report
                  </B>
                </details>
                {job && (
                  <>
                    <div className="job-status">
                      <strong>Report {job.version}</strong>
                      <span>
                        {job.stale
                          ? "Case changed: update needed"
                          : (
                              {
                                research: "Collecting official guidance",
                                writing: "Writing the report",
                                pdf: "Creating PDF",
                                email: "Sending email",
                                ready: "Ready",
                              } as any
                            )[job.stage]}
                      </span>
                      {job.stage !== "ready" && !job.stale && (
                        <B
                          onClick={() =>
                            run("Continuing saved report", () => resume(job))
                          }
                        >
                          Continue / retry
                        </B>
                      )}
                      {job.pdfReady && (
                        <a
                          className="download-button"
                          href={reportsAPI.pdfURL(job.id)}
                        >
                          Download PDF ↓
                        </a>
                      )}
                    </div>
                    {job.error && (
                      <p className="error">{job.error} Your case is saved.</p>
                    )}
                    {versions.length > 1 && (
                      <label>
                        Report version
                        <select
                          value={job.id}
                          onChange={(e) =>
                            setJob(
                              versions.find((v) => v.id === e.target.value),
                            )
                          }
                        >
                          {versions.map((v) => (
                            <option key={v.id} value={v.id}>
                              Report {v.version} / {v.stage}
                              {v.stale ? " / earlier facts" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {job.report && (
                      <div className="report-paper">
                        <div className="paper-head">
                          <span>STRIKEOUT</span>
                          <small>PRIVATE / REPORT {job.version}</small>
                        </div>
                        <h2>Incident overview</h2>
                        <p>{job.report.summary}</p>
                        <h3>Evidence observations</h3>
                        {job.report.observations.map((o: any, i: number) => (
                          <p key={i}>
                            {o.text} <small>{o.evidenceIds.join(", ")}</small>
                          </p>
                        ))}

                        <h3>Suggested next steps</h3>
                        {job.report.nextSteps.map((s: any) => (
                          <article key={s.id}>
                            <strong>{s.title}</strong>
                            <p>{s.detail}</p>
                            <small>Sources: {s.sourceIds.join(", ")}</small>
                          </article>
                        ))}
                        <h3>Official sources</h3>
                        {job.research.sources.map((s: any) => (
                          <p key={s.id}>
                            <a href={s.url} target="_blank" rel="noreferrer">
                              [{s.id}] {s.title} ↗
                            </a>
                          </p>
                        ))}
                        {job.research.searchEntryPoint && (
                          <iframe
                            title="Google Search attribution"
                            sandbox="allow-popups allow-popups-to-escape-sandbox"
                            srcDoc={job.research.searchEntryPoint}
                            style={{ width: "100%", height: 110, border: 0 }}
                          />
                        )}
                        <p className="mini-note">
                          {job.method === "local_template"
                            ? "Local template, without AI or fresh research."
                            : "AI-assisted guidance."}{" "}
                          User-reported facts. No complaint has been submitted.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {tab === "help" && current && (
              <>
                <span className="eyebrow">ONE STEP AT A TIME</span>
                <h1>What happens next?</h1>
                {!job?.report ? (
                  <p>
                    Generate your report first, or use Get help for general
                    resources.
                  </p>
                ) : (
                  <>
                    <B
                      disabled={!!busy || job.stale}
                      onClick={() =>
                        run("Loading your report summary", async () =>
                          setAnswer(await reportsAPI.summarise(job.id)),
                        )
                      }
                    >
                      Read my report summary
                    </B>
                    {job.report.nextSteps.map((s: any) => (
                      <article className="step-card" key={s.id}>
                        <label className="check">
                          <input
                            type="checkbox"
                            disabled={!!busy || job.stale}
                            checked={progress.some(
                              (p) => p.reportId === job.id && p.stepId === s.id,
                            )}
                            onChange={(e) =>
                              run("Saving progress", async () => {
                                const x = await reportsAPI.progress(
                                  job.id,
                                  s.id,
                                  e.target.checked,
                                );
                                setProgress(x.completedSteps);
                              })
                            }
                          />
                          <strong>{s.title}</strong>
                        </label>
                        <p>{s.detail}</p>
                        <small>
                          Completion is recorded as your statement, not
                          independent verification.
                        </small>
                      </article>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run("Thinking about your next step", async () => {
                          const x = await reportsAPI.ask(job.id, question);
                          setAnswer(x);
                          setQuestion("");
                          await loadReports(current.id);
                        });
                      }}
                    >
                      <label>
                        Tell us what changed, or ask a question
                        <textarea
                          rows={3}
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          required
                          maxLength={3000}
                        />
                      </label>
                      <small>
                        Sending shares this message, your report and recorded
                        progress with Gemini. Important new facts should also be
                        saved in Your story.
                      </small>
                      <B type="submit" disabled={!!busy || job.stale}>
                        Ask with my case context
                      </B>
                    </form>
                    {answer && (
                      <div className="answer">
                        <h3>Your next step</h3>
                        <p>{answer.answer}</p>
                        <small>Sources: {answer.sourceIds?.join(", ")}</small>
                      </div>
                    )}
                    {messages
                      .filter((m) => m.reportId === job.id)
                      .slice(-6)
                      .reverse()
                      .map((m) => (
                        <details key={m.id}>
                          <summary>
                            {m.mode === "summary"
                              ? "Report summary"
                              : m.message}
                          </summary>
                          <p>{m.answer}</p>
                        </details>
                      ))}
                  </>
                )}
              </>
            )}
            {tab === "complaint" && current && (
              <>
                <span className="eyebrow">REVIEW BEFORE SHARING</span>
                <h1>A draft. Your words.</h1>
                <p>
                  This deterministic draft works without AI. You approve the
                  exact wording before export. Submit it yourself through the
                  official channel.
                </p>
                <B
                  onClick={() =>
                    run("Preparing complaint draft", async () => {
                      const x = await casesAPI.generateDraft(current.id, {
                        targetId: "national_portal",
                        includeContact: false,
                        evidenceIds: selected,
                      });
                      setCurrent(x.case);
                    })
                  }
                >
                  Prepare official-portal draft
                </B>
                {current.reporting?.draft && (
                  <>
                    <textarea
                      aria-label="Complaint draft"
                      rows={15}
                      value={current.reporting.draft.text}
                      onChange={(e) =>
                        setCurrent({
                          ...current,
                          reporting: {
                            ...current.reporting,
                            draft: {
                              ...current.reporting.draft,
                              text: e.target.value,
                            },
                            draftStatus: "editing",
                          },
                        })
                      }
                    />
                    <div className="toolbar">
                      <B
                        onClick={() =>
                          run("Saving draft", async () => {
                            const x = await casesAPI.editDraft(
                              current.id,
                              current.reporting.draft.text,
                            );
                            setCurrent(x.case);
                          })
                        }
                      >
                        Save wording
                      </B>
                      <B
                        disabled={
                          !!busy || current.reporting.draftStatus === "editing"
                        }
                        onClick={() =>
                          run("Approving reviewed draft", async () => {
                            const x = await casesAPI.approveDraft(
                              current.id,
                              current.reporting.draft.text,
                            );
                            setCurrent(x.case);
                            setNotice(
                              "This exact draft is approved for export. Nothing submitted.",
                            );
                          })
                        }
                      >
                        I reviewed this exact draft
                      </B>
                      {current.reporting.draftStatus === "approved" && (
                        <a
                          className="download-button"
                          href={casesAPI.exportURL(current.id, "html")}
                        >
                          Download reviewed draft
                        </a>
                      )}
                      {current.reporting.draftStatus === "approved" && (
                        <B onClick={() => run("Emailing reviewed draft", async () => {
                          if (!confirm("Send this exact reviewed draft to cyberdost@mha.gov.in? Only the draft text will be emailed.")) return;
                          const x = await casesAPI.emailCyberdost(current.id, current.reporting.draft.text);
                          setCurrent(x.case);
                          setNotice("Email service accepted your message to cyberdost@mha.gov.in.");
                        })}>Email CyberDost</B>
                      )}
                    </div>
                  </>
                )}
                <p>
                  <a
                    href="https://cybercrime.gov.in/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open National Cyber Crime Reporting Portal ↗
                  </a>
                </p>
              </>
            )}
            {tab === "services" && (
              <>
                <span className="eyebrow">THE RIGHT HELP FOR THE MOMENT</span>
                <h1>You don't have to do it alone.</h1>
                <SpecialistBots />
                <div className="service-grid">
                  <article>
                    <strong>Technical recovery</strong>
                    <p>
                      Use official account recovery. A cybersecurity
                      professional may help assess a complex incident.
                    </p>
                    <a
                      href="https://support.google.com/accounts/answer/6294825"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google recovery ↗
                    </a>
                    <a
                      href="https://www.instagram.com/hacked/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram recovery ↗
                    </a>

                  </article>
                  <article>
                    <strong>Reporting assistance</strong>
                    <p>
                      Organise evidence and prepare a reviewed complaint in your
                      case.
                    </p>
                    <B onClick={() => navigate(current ? "complaint" : "new")}>
                      Prepare a case
                    </B>
                    <a
                      href="https://cybercrime.gov.in/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official cybercrime portal ↗
                    </a>
                  </article>

                  <article>
                    <strong>Pop, for everyday browsing</strong>
                    <p>
                      Your local watchlist, sharing checks, evidence capture and
                      a very pettable cat.
                    </p>
                    <a href="/pop-chromium-2.3.2.zip" download>
                      Chromium download ↓
                    </a>
                    <a href="/pop-firefox-2.3.2.zip" download>
                      Firefox / Zen download ↓
                    </a>
                  </article>

                </div>
              </>
            )}
            {tab === "settings" && (
              <>
                <span className="eyebrow">DELIVERY & YOUR COMPANION</span>
                <h1>Your preferences.</h1>
                <ExtensionSettings />
                <section>
                  <h2>Report email</h2>
                  <p className="quiet-status-copy">
                    {caps.emailConfigured
                      ? "Verify an address before opting in to report delivery."
                      : "Email service is not configured. Report downloads still work."}
                  </p>
                  <p>
                    {email.verified
                      ? "Verified: " + email.email
                      : "No verified address."}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run("Sending verification code", async () => {
                        await reportsAPI.requestEmailCode(
                          String(f.get("email")),
                        );
                        setNotice("Check your inbox for the six-digit code.");
                      });
                    }}
                  >
                    <label>
                      Email address
                      <input name="email" type="email" required />
                    </label>
                    <B type="submit" disabled={!!busy || !caps.emailConfigured}>
                      Send code
                    </B>
                  </form>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run("Verifying address", async () => {
                        setEmail(await reportsAPI.confirmEmail(code));
                        setNotice(
                          "Email verified. Choose delivery when generating a report.",
                        );
                      });
                    }}
                  >
                    <label>
                      Six-digit code
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                      />
                    </label>
                    <B type="submit" disabled={!!busy || !caps.emailConfigured}>
                      Verify address
                    </B>
                  </form>
                </section>
                <section><h2>Connect Pop</h2><p>Account connection and extension settings are in one place.</p><a href="/pop-settings.html">Open Pop settings and connect your account</a></section>
                <section>
                  <h2>Privacy</h2>
                  <p>
                    Cases are private to this account. AI receives context only
                    after approval. Local extension data is separate from
                    website data.
                  </p>
                  <B
                    onClick={() =>
                      run("Exporting cases", async () => {
                        const x = await casesAPI.listCases();
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(x.cases, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "strikeout-cases.json";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      })
                    }
                  >
                    Export all cases
                  </B>
                  <B
                    onClick={() =>
                      run("Deleting account", async () => {
                        if (
                          !confirm(
                            "Delete this account and its server-side cases, evidence and reports? This cannot be undone.",
                          )
                        )
                          return;
                        await api("/api/account", "DELETE");
                        window.dispatchEvent(
                          new Event("strikeout-auth-changed"),
                        );
                        navigate("home");
                        setMessages([]);
                        setAnswer(null);
                        setVersions([]);
                        setProgress([]);
                        setSelected([]);
                        setForm(blank);
                        setOwner(null);
                        setItems([]);
                        setCurrent(null);
                        setJob(null);
                      })
                    }
                  >
                    Delete account and cases
                  </B>
                </section>
              </>
            )}
          </main>
        </div>
        <footer className="desk-footer">
          <span>Private case workspace</span>
          <span>{busy || "Ready"} · AI assistance, human decisions</span>
        </footer>
      </div>
    );
  }
  return (
    <BusyContext.Provider value={!!busy}>
      {renderContent()}
    </BusyContext.Provider>
  );
}

