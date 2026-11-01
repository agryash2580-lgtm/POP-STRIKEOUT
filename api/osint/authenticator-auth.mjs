import { securityState, verifyMfaCode, mfaConfigured } from "../mfa.mjs";
import * as storage from "../store.mjs";
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
// Reuses account MFA's encrypted secrets, atomic replay checks and attempt lockout.
export function authenticatorAuthService({
  store = storage,
  now = Date.now,
  security = securityState,
  consume = verifyMfaCode,
  configured = mfaConfigured,
} = {}) {
  function binding(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("strikeout_session="))
      ?.slice(18);
    if (!token) fail(401, "Sign in before verifying your authenticator.");
    return (
      "osint_authenticator/" + storage.hash(req.osintUser.id + ":" + token)
    );
  }
  async function state(req) {
    const [account, grant] = await Promise.all([
      security(req.osintUser.id),
      store.read(binding(req)),
    ]);
    const verified = !!(
      configured() &&
      account.enabled &&
      grant?.version === account.version &&
      grant.expires > now()
    );
    return {
      required: true,
      method: "authenticator",
      configured: configured(),
      enabled: !!account.enabled,
      verified,
      verifiedUntil: verified ? grant.expires : null,
      instagramOwnershipVerified: false,
      phoneOwnershipVerified: false,
    };
  }
  async function verify(req) {
    if (!configured())
      fail(
        503,
        "Authenticator encryption is not configured. Contact the site operator.",
      );
    if (typeof req.body?.code !== "string" || !/^\d{6}$/.test(req.body.code))
      fail(400, "Enter the six-digit code from your authenticator app.");
    const key = binding(req),
      account = await consume(req.osintUser.id, req.body.code);
    await store.write(key, {
      version: account.version,
      expires: now() + 1800000,
    });
    return state(req);
  }
  async function requireVerified(req) {
    if (!(await state(req)).verified)
      fail(403, "Verify your authenticator before checking exposure.");
    const path = (req.path || req.url || "")
      .split("?")[0]
      .toLowerCase()
      .replace(/\/+$/, "");
    if (path === "/check" && ["instagram", "phone"].includes(req.body?.service))
      fail(
        403,
        "This search is locked until ownership of the target " +
          (req.body.service === "phone"
            ? "phone number"
            : "Instagram account") +
          " can be verified. An authenticator code does not prove target ownership.",
      );
  }
  return { state, verify, requireVerified };
}
