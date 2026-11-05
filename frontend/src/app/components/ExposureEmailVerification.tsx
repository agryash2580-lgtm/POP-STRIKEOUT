import React, { useEffect, useRef, useState } from "react";
import { requestJSON } from "../../../../shared/http-client.js";

type EmailProof = { email: string | null; verified: boolean };

export function ExposureEmailVerification({ onUseEmail }: { onUseEmail: (email: string) => void }) {
  const epoch = useRef(0);
  const [proof, setProof] = useState<EmailProof | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const version = ++epoch.current;
    setBusy("load"); setError(""); setNotice(""); setCode("");
    try {
      const [status, caps] = await Promise.all([
        requestJSON("/api/reports/email"),
        requestJSON("/api/reports/capabilities"),
      ]);
      if (version !== epoch.current) return;
      setProof({ email: typeof status.email === "string" ? status.email : null, verified: status.verified === true });
      setConfigured(caps.emailConfigured === true);
      setEmail(previous => previous || (typeof status.email === "string" ? status.email : ""));
    } catch (error: any) {
      if (version === epoch.current) {
        setProof(null); setConfigured(null); setError(error.message);
      }
    } finally {
      if (version === epoch.current) setBusy("");
    }
  }

  useEffect(() => {
    const reset = () => {
      setProof(null); setConfigured(null); setEmail(""); setCode("");
      setApproved(false); setNotice(""); refresh();
    };
    const onReturn = (event: any) => {
      if (event.detail?.section === "exposure") refresh();
    };
    refresh();
    window.addEventListener("strikeout-auth-changed", reset);
    window.addEventListener("strikeout-workspace", onReturn);
    return () => {
      epoch.current++;
      window.removeEventListener("strikeout-auth-changed", reset);
      window.removeEventListener("strikeout-workspace", onReturn);
    };
  }, []);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !approved || !configured) return;
    const version = ++epoch.current;
    setBusy("send"); setError(""); setNotice(""); setProof(null);
    try {
      const result = await requestJSON("/api/reports/email/verification", {
        method: "POST", body: { email: email.trim() },
      });
      if (version !== epoch.current) return;
      if (result.sent !== true) throw Error("Sending the code was not confirmed. Refresh verification status before trying again.");
      setProof({ email: email.trim().toLowerCase(), verified: false });
      setCode(""); setApproved(false);
      setNotice("Code sent. Check your inbox and spam folder; it expires in 10 minutes.");
    } catch (error: any) {
      if (version === epoch.current) setError(error.message);
    } finally {
      if (version === epoch.current) setBusy("");
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    const version = ++epoch.current;
    setBusy("confirm"); setError(""); setNotice("");
    try {
      const result = await requestJSON("/api/reports/email/confirm", {
        method: "POST", body: { code },
      });
      if (version !== epoch.current) return;
      if (result.verified !== true || typeof result.email !== "string")
        throw Error("Email verification was not confirmed. Refresh verification status.");
      setProof({ email: result.email, verified: true });
      setCode(""); setNotice("Email verified. You can now use this exact address for your exposure check.");
      onUseEmail(result.email);
    } catch (error: any) {
      if (version === epoch.current) setError(error.message);
    } finally {
      if (version === epoch.current) setBusy("");
    }
  }

  return <section className="mini-note" aria-label="Verified email for exposure checks">
    <h2>Verify your email for this check</h2>
    <p>Prove access to the exact address you want to search. This also sets your report-delivery address in Cases. Verifying does not start a search.</p>
    {busy === "load" && <p role="status">Checking email verification…</p>}
    {proof?.verified && proof.email ? <>
      <p>Verified address: <strong>{proof.email}</strong></p>
      <button type="button" disabled={!!busy} onClick={() => onUseEmail(proof.email!)}>Use verified email</button>
    </> : proof && <p>No verified email is available for this check.</p>}
    {configured === false && <p role="status">Email verification is unavailable because this server has no email delivery service configured. An existing verified address still works. You can also review your documents, check a password prefix, or try the fictional demo.</p>}
    {configured === true && <form onSubmit={send}>
      <fieldset disabled={!!busy} style={{ border: 0, padding: 0 }}>
        {proof?.verified && <p>Requesting a new code replaces the existing email verification until you confirm the new code.</p>}
        <label>Your email to verify<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setApproved(false); }} /></label>
        <label className="check"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} />This is my email and I want StrikeOut to send me a verification code.</label>
        <button disabled={!approved}>{busy === "send" ? "Sending code…" : "Send verification code"}</button>
      </fieldset>
    </form>}
    {proof?.email && !proof.verified && <form onSubmit={confirm}>
      <fieldset disabled={!!busy} style={{ border: 0, padding: 0 }}>
        <p>Enter the code sent to <strong>{proof.email}</strong>. If it has expired, request another code above.</p>
        <label>Email verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
        <button disabled={!/^\d{6}$/.test(code)}>{busy === "confirm" ? "Verifying email…" : "Verify email"}</button>
      </fieldset>
    </form>}
    <button type="button" disabled={!!busy} onClick={refresh}>Refresh verification status</button>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
