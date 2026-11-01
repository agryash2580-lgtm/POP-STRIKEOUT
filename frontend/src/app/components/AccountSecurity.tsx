import React, { useEffect, useState } from "react";
async function request(path: string, body?: any) {
  const r = await fetch("/api/auth/mfa/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const x = await r.json();
  if (!r.ok) throw Error(x.error || "Security request failed.");
  return x;
}
export function MFAChallenge({ onComplete, onCancel }: any) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="recovery auth-screen">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await request("verify", { code });
            await onComplete();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>One more check.</h2>
        <p>
          Your password or Google sign-in passed. Enter your authenticator code
          or a one-use recovery code to open this account.
        </p>
        <label>
          Authenticator or recovery code
          <input
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={24}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy} type="submit">
          Verify and sign in
        </button>
        <button
          disabled={busy}
          type="button"
          onClick={async () => {
            try {
              await request("cancel", {});
              onCancel();
            } catch (error: any) {
              setError(error.message);
            }
          }}
        >
          Cancel sign-in
        </button>
      </form>
    </div>
  );
}
export function AccountSecurity() {
  const [state, setState] = useState<any>(null),
    [setup, setSetup] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setState(await request("status"));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
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
      <h2>Account security / MFA &amp; SSO</h2>
      <p>
        Google sign-in uses OpenID Connect SSO. Add your own authenticator as a
        separate second factor for either Google or password sign-in. Google
        sign-in alone does not mean STRIKEOUT MFA is enabled.
      </p>
      {state && (
        <p>
          Authenticator MFA: {state.enabled ? "enabled" : "not enabled"} ·{" "}
          {state.recoveryRemaining} recovery codes left.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {!state?.enabled && !setup && (
        <button
          disabled={busy || !state?.configured}
          onClick={() => run(async () => setSetup(await request("setup", {})))}
        >
          Set up authenticator MFA
        </button>
      )}
      {setup && (
        <>
          <p>
            Scan with Google Authenticator, Microsoft Authenticator or another
            TOTP app. Keep this setup key private.
          </p>
          <img
            src={setup.qr}
            width="200"
            height="200"
            alt="Authenticator setup QR code"
          />
          <p>
            Manual setup key: <code>{setup.secret}</code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const x = await request("enable", { code });
                setCodes(x.recoveryCodes);
                setSetup(null);
                setCode("");
                await refresh();
              });
            }}
          >
            <label>
              Six-digit authenticator code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                pattern="[0-9]{6}"
              />
            </label>
            <button disabled={busy}>Enable MFA</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSetup(null)}
            >
              Cancel setup
            </button>
          </form>
        </>
      )}
      {codes.length > 0 && (
        <div className="mini-note">
          <strong>Save these recovery codes now. They appear only once.</strong>
          <p>
            Each code works once if you lose your authenticator. Anyone with
            them can complete your second factor.
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{codes.join("\n")}</pre>
          <button
            onClick={() => {
              const b = new Blob(
                ["STRIKEOUT recovery codes\n" + codes.join("\n")],
                { type: "text/plain" },
              );
              const u = URL.createObjectURL(b),
                a = document.createElement("a");
              a.href = u;
              a.download = "strikeout-recovery-codes.txt";
              a.click();
              setTimeout(() => URL.revokeObjectURL(u), 1000);
            }}
          >
            Download recovery codes
          </button>
          <button onClick={() => setCodes([])}>I saved them</button>
        </div>
      )}
      {state?.enabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !confirm(
                "Disable authenticator MFA? Other sessions and existing Pop pairings will require signing in/pairing again.",
              )
            )
              return;
            run(async () => {
              await request("disable", { code });
              setCode("");
              setCodes([]);
              await refresh();
            });
          }}
        >
          <p>
            Enabling or disabling MFA revokes older sessions and extension
            pairings. Pair Pop again afterwards. A code already used for
            setup/sign-in cannot be reused; wait for the next code or use a
            recovery code.
          </p>
          <label>
            Current authenticator or recovery code
            <input
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button disabled={busy}>Disable MFA</button>
        </form>
      )}
    </section>
  );
}
