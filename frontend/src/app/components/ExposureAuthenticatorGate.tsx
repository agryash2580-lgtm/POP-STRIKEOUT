import React, { useEffect, useRef, useState } from "react";
import { AccountSecurity } from "./AccountSecurity";
export function ExposureAuthenticatorGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const generation = useRef(0),
    [state, setState] = useState<any>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showSetup, setShowSetup] = useState(false),
    [checkingSetup, setCheckingSetup] = useState(false),
    [setupProgress, setSetupProgress] = useState(""),
    [clock, setClock] = useState(Date.now());
  async function call(path: string, body?: any) {
    const r = await fetch("/api/osint/auth/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json().catch(() => {
      throw Error(
        "Verification service unavailable. Please refresh or contact the site operator.",
      );
    });
    if (!r.ok) throw Error(data.error || "Verification failed.");
    return data;
  }
  async function refresh() {
    const version = generation.current;
    try {
      const data = await call("status");
      if (version === generation.current) {
        setState(data);
        if (!data.enabled) setShowSetup(true);
        setError("");
        return data;
      }
    } catch (e: any) {
      if (version === generation.current) {
        setState(null);
        setError(e.message);
      }
    }
  }
  useEffect(() => {
    const changed = () => {
      generation.current++;
      setState(null);
      setCode("");
      setBusy(false);
      setShowSetup(false);
      setCheckingSetup(false);
      setSetupProgress("");
      void refresh();
    };
    void refresh();
    const timer = setInterval(() => setClock(Date.now()), 1000),
      status = setInterval(refresh, 30000);
    const securityChanged = () => {
      generation.current++;
      setCode("");
      setBusy(false);
      setSetupProgress("");
      setCheckingSetup(false);
      void refresh();
    };
    window.addEventListener("strikeout-auth-changed", changed);
    window.addEventListener("strikeout-mfa-changed", securityChanged);
    return () => {
      generation.current++;
      clearInterval(timer);
      clearInterval(status);
      window.removeEventListener("strikeout-auth-changed", changed);
      window.removeEventListener("strikeout-mfa-changed", securityChanged);
    };
  }, []);
  const verified = state?.verified && state.verifiedUntil > clock;
  return (
    <>
      <section className="mini-note exposure-auth-gate">
        <h2>
          {verified ? "Authenticator verified" : "Verify to check exposure"}
        </h2>
        <p>
          Use a free authenticator app. No SMS or Twilio account is needed.
          Codes protect your STRIKEOUT account; they do not prove ownership of a
          phone number or social profile.
        </p>
        {!state && (
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("strikeout-open", {
                  detail: { section: "cases" },
                }),
              )
            }
          >
            Open sign-in
          </button>
        )}
        {state && !state.configured && (
          <p role="alert">
            Authenticator setup is awaiting the site operator’s encryption-key
            configuration. Exposure checks stay locked.
          </p>
        )}
        {state?.configured && !verified && (
          <>
            {(!state.enabled || showSetup) && (
              <>
                <AccountSecurity
                  onSetupComplete={() => {
                    setShowSetup(false);
                    setSetupProgress("");
                    void refresh();
                  }}
                />
                {!state.enabled && (
                  <button
                    type="button"
                    disabled={checkingSetup}
                    onClick={async () => {
                      const version = generation.current;
                      setCheckingSetup(true);
                      setSetupProgress("");
                      try {
                        const updated = await refresh();
                        if (version !== generation.current || !updated) return;
                        setSetupProgress(
                          updated.enabled
                            ? "Your authenticator is enabled. Save any recovery codes above, then enter a fresh six-digit code below."
                            : "Setup is not complete yet. Choose Set up authenticator MFA, scan the QR code, then enter its six-digit code and click Enable MFA. After saving your recovery codes, verification opens automatically.",
                        );
                      } finally {
                        if (version === generation.current)
                          setCheckingSetup(false);
                      }
                    }}
                  >
                    {checkingSetup ? "Checking setup…" : "Check setup progress"}
                  </button>
                )}
                {setupProgress && (
                  <div className="mini-note" role="status">
                    {setupProgress}
                  </div>
                )}
              </>
            )}
            {state.enabled && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy) return;
                  const version = generation.current;
                  setBusy(true);
                  setError("");
                  try {
                    const data = await call("verify", { code });
                    if (version === generation.current) {
                      setState(data);
                      setCode("");
                      setShowSetup(false);
                    }
                  } catch (e: any) {
                    if (version === generation.current) setError(e.message);
                  } finally {
                    if (version === generation.current) setBusy(false);
                  }
                }}
              >
                <label>
                  Six-digit authenticator code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <p>
                  Use a fresh code. A code used for setup or sign-in cannot be
                  reused; wait for the next one.
                </p>
                <button disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify and continue"}
                </button>
              </form>
            )}
          </>
        )}
        {verified && <p>Verified for this session for up to 30 minutes.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      {verified ? children : null}
    </>
  );
}
