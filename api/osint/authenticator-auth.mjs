import { securityState, verifyMfaCode, mfaConfigured } from "../mfa.mjs";
import * as storage from "../store.mjs";
import { domainOwnershipService } from "./domain-ownership.mjs";
import { publicURL } from "./image-url.mjs";
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
  domains = domainOwnershipService(),
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
    const key = binding(req);
    let account;
    try {
      account = await consume(req.osintUser.id, req.body.code);
    } catch (error) {
      if (error.status === 401)
        fail(
          401,
          "Code invalid or already used. Wait for the next six-digit code from your authenticator app.",
        );
      throw error;
    }
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
    if (path === "/check" && req.body?.service === "email") {
      const target = req.body?.input?.email;
      const address = await store.read("analysis_email/" + req.osintUser.id);
      if (typeof target !== "string" || !address?.verifiedAt ||
          typeof address.email !== "string" ||
          target.trim().toLowerCase() !== address.email.trim().toLowerCase())
        fail(403, "Verify this exact email address in Check Exposure before searching. Your authenticator alone does not prove email ownership.");
    }
    if (path === "/check" && ["instagram", "phone", "linkedin", "identity_cards"].includes(req.body?.service))
      fail(403, "This personal search is locked until ownership of the target can be verified. Your authenticator alone does not prove target ownership.");
    if (path === "/dorks")
      await domains.requireOwned(req, req.body?.domain);
    if (path === "/images/reverse") {
      const image = publicURL(req.body?.imageUrl);
      await domains.requireOwned(req, image.hostname);
    }
  }
  return { state, verify, requireVerified };
}
