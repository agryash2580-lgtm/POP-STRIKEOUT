import React, { useEffect, useState, useRef } from "react";
export function ExposurePhoneGate({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const [state, setState] = useState<any>(null),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [consent, setConsent] = useState(false),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [clock, setClock] = useState(Date.now());
  async function call(path: string, body?: any) {
    const r = await fetch("/api/osint/phone/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => {
      throw Error(
        "Verification service unavailable. Please refresh or contact the site operator.",
      );
    });
    if (!r.ok) throw Error(data.error || "Verification unavailable.");
    return data;
  }
  useEffect(() => {
    let active = true;
    async function refresh() {
      const version = generation.current;
      try {
        const data = await call("status");
        if (active && version === generation.current) {
          setState(data);
          setError("");
        }
      } catch (e: any) {
        if (active && version === generation.current) {
          setState(null);
          setError(e.message);
        }
      }
    }
    const changed = () => {
      generation.current++;
      setBusy(false);
      setResendAt(0);
      setState(null);
      setPhone("");
      setCode("");
      setConsent(false);
      setSent(false);
      void refresh();
    };
    void refresh();
    const timer = setInterval(() => {
      setClock(Date.now());
    }, 1000);
    const check = setInterval(refresh, 60000);
    window.addEventListener("strikeout-auth-changed", changed);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(check);
      window.removeEventListener("strikeout-auth-changed", changed);
    };
  }, []);
  const verified = state?.verified && state.verifiedUntil > clock;
  async function submit(e: React.FormEvent, action: "send" | "verify") {
    e.preventDefault();
    if (busy) return;
    const version = generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await call(
        action,
        action === "send" ? { phone, consent } : { code },
      );
      if (version !== generation.current) return;
      if (action === "send") {
        setSent(true);
        setCode("");
        setResendAt(Date.now() + data.resendAfterSeconds * 1000);
      } else {
        setState(data);
        setCode("");
        setPhone("");
        setSent(false);
      }
    } catch (e: any) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="mini-note">
        <strong>
          {verified ? "Phone verified" : "Verify your phone to check exposure"}
        </strong>
        {verified ? (
          <p>
            {state.phoneLabel} · Verified for this session. Instagram ownership
            requires a separate check.
          </p>
        ) : (
          <p>
            Enter your own number and confirm the SMS code. This verifies
            control of your phone, not ownership of Instagram or other profiles.
          </p>
        )}
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
            SMS verification is awaiting service setup. Exposure checks are
            locked. Contact the site operator.
          </p>
        )}
        {!verified && state?.configured && (
          <>
            <form onSubmit={(e) => submit(e, "send")}>
              <label>
                Your phone number (with country code)
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={26}
                  required
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setConsent(false);
                  }}
                  placeholder="+91…"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                This is my phone. Send a verification SMS through Twilio.
              </label>
              <button disabled={!consent || busy || resendAt > clock}>
                {resendAt > clock
                  ? "Resend in " + Math.ceil((resendAt - clock) / 1000) + "s"
                  : sent
                    ? "Resend code"
                    : "Send code"}
              </button>
            </form>
            {(sent || state.pending) && (
              <form onSubmit={(e) => submit(e, "verify")}>
                <label>
                  SMS code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    maxLength={10}
                    required
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <button disabled={busy || code.length < 4}>
                  Verify and continue
                </button>
              </form>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      {verified ? children : null}
    </>
  );
}
