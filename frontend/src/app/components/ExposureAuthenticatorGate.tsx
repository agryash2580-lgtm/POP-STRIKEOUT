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
    [clock, setClock] = useState(Date.now());
  async function call(path: string, body?: any) {
    const r = await fetch("/api/osint/auth/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
      void refresh();
    };
    void refresh();
    const timer = setInterval(() => setClock(Date.now()), 1000),
      status = setInterval(refresh, 30000);
    window.addEventListener("strikeout-auth-changed", changed);
    return () => {
      generation.current++;
      clearInterval(timer);
      clearInterval(status);
      window.removeEventListener("strikeout-auth-changed", changed);
    };
  }, []);
  const verified = state?.verified && state.verifiedUntil > clock;
  return (
    <>
      <section className="mini-note">
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
                <AccountSecurity />
                <button
                  type="button"
                  onClick={() => {
                    void refresh();
                  }}
                >
                  I finished setup — refresh verification
                </button>
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
