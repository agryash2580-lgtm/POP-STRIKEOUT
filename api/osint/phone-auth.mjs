import { parsePhoneNumberFromString } from "libphonenumber-js";
import { createHmac } from "node:crypto";
import * as storage from "../store.mjs";
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
export function normalizePhone(value) {
  if (typeof value !== "string" || !/^\+[0-9 ()-]{7,25}$/.test(value))
    fail(400, "Enter your phone number with its country code.");
  const phone = parsePhoneNumberFromString(value);
  if (!phone?.isValid()) fail(400, "Enter a valid international phone number.");
  return phone.number;
}
export function phoneAuthService({
  env = process.env,
  fetcher = fetch,
  store = storage,
  now = Date.now,
} = {}) {
  const configured = () =>
    /^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID || "") &&
    /^VA[0-9a-f]{32}$/i.test(env.TWILIO_VERIFY_SERVICE_SID || "") &&
    !!env.TWILIO_AUTH_TOKEN &&
    String(env.OSINT_PHONE_HASH_KEY || "").length >= 32;
  const fingerprint = (phone) =>
    createHmac("sha256", env.OSINT_PHONE_HASH_KEY).update(phone).digest("hex");
  function binding(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("strikeout_session="))
      ?.slice(18);
    if (!token) fail(401, "Sign in again before verifying your phone.");
    return "osint_phone/" + storage.hash(req.osintUser.id + ":" + token);
  }
  async function provider(action, fields) {
    if (!configured())
      fail(
        503,
        "SMS verification is not configured. Exposure checks remain locked.",
      );
    try {
      const response = await fetcher(
        "https://verify.twilio.com/v2/Services/" +
          env.TWILIO_VERIFY_SERVICE_SID +
          "/" +
          action,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN,
              ).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(fields),
        },
      );
      if (!response.ok)
        fail(
          response.status === 429 ? 429 : 502,
          "SMS provider could not complete verification. Please try again later.",
        );
      const text = await response.text();
      if (text.length > 20000) fail(502, "Invalid SMS provider response.");
      return JSON.parse(text);
    } catch (e) {
      if (e.status) throw e;
      fail(
        502,
        "SMS verification is temporarily unavailable. Checks remain locked.",
      );
    }
  }
  // Persistent atomic budget slots apply across serverless instances and sessions.
  async function budget(scope, max, windowMs) {
    const bucket = Math.floor(now() / windowMs);
    for (let slot = 0; slot < max; slot++)
      if (
        await store.createIfMissing(
          "osint_sms_limits/" + storage.hash(scope) + "_" + bucket + "_" + slot,
          { expires: (bucket + 1) * windowMs },
        )
      )
        return;
    fail(
      429,
      "SMS verification limit reached. Please wait before trying again.",
    );
  }
  async function state(req) {
    const record = await store.read(binding(req));
    return {
      pending: !!(record?.expires > now() && !record?.verifiedUntil),
      required: true,
      configured: configured(),
      verified: !!(record?.verifiedUntil > now()),
      verifiedUntil:
        record?.verifiedUntil > now() ? record.verifiedUntil : null,
      phoneLabel: record?.verifiedUntil > now() ? record.phoneLabel : null,
      instagramOwnershipVerified: false,
    };
  }
  async function send(req) {
    if (!configured())
      fail(
        503,
        "SMS verification is not configured. Exposure checks remain locked.",
      );
    if (req.body?.consent !== true)
      fail(400, "Approve sending an SMS to your own phone.");
    const phone = normalizePhone(req.body.phone),
      key = binding(req),
      phoneHash = fingerprint(phone);
    await budget("cooldown:" + req.osintUser.id, 1, 60000);
    await budget("account:" + req.osintUser.id, 5, 3600000);
    await budget("phone:" + phoneHash, 5, 3600000);
    await budget("ip:" + req.ip, 10, 3600000);
    const data = await provider("Verifications", { To: phone, Channel: "sms" });
    if (
      data.status !== "pending" ||
      !/^VE[0-9a-f]{32}$/i.test(data.sid || "") ||
      data.to !== phone ||
      data.channel !== "sms"
    )
      fail(502, "SMS provider did not start a valid verification.");
    await store.write(key, {
      sid: data.sid,
      phoneHash,
      phoneLabel: "•••• " + phone.slice(-4),
      expires: now() + 600000,
      attempts: 0,
      verifiedUntil: 0,
    });
    return {
      sent: true,
      phoneLabel: "•••• " + phone.slice(-4),
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    };
  }
  async function verify(req) {
    if (!configured())
      fail(
        503,
        "SMS verification is not configured. Exposure checks remain locked.",
      );
    const code = req.body?.code;
    if (typeof code !== "string" || !/^\d{4,10}$/.test(code))
      fail(400, "Enter the code from your SMS.");
    const key = binding(req),
      record = await store.read(key);
    if (!record || record.expires <= now() || record.verifiedUntil)
      fail(400, "Request a new verification code.");
    if (record.attempts >= 5)
      fail(429, "Too many incorrect codes. Request a new code later.");
    record.attempts++;
    await store.write(key, record);
    const data = await provider("VerificationCheck", {
      VerificationSid: record.sid,
      Code: code,
    });
    if (
      data.status !== "approved" ||
      data.sid !== record.sid ||
      data.channel !== "sms" ||
      fingerprint(normalizePhone(data.to)) !== record.phoneHash
    )
      fail(400, "The code was not approved. Check it and try again.");
    if (
      !(await store.createIfMissing(
        "osint_sms_used/" + storage.hash(record.sid),
        { expires: now() + 86400000 },
      ))
    )
      fail(409, "This verification has already been used. Request a new code.");
    record.verifiedUntil = now() + 1800000;
    record.expires = 0;
    delete record.sid;
    await store.write(key, record);
    return state(req);
  }
  async function requireVerified(req) {
    const path = (req.path || req.url || "")
      .split("?")[0]
      .toLowerCase()
      .replace(/\/+$/, "");
    const record = await store.read(binding(req));
    if (
      !configured() ||
      !record?.verifiedUntil ||
      record.verifiedUntil <= now()
    )
      fail(403, "Verify your phone by SMS before checking exposure.");
    if (
      path === "/check" &&
      req.body?.service === "phone" &&
      fingerprint(normalizePhone(req.body.input?.phone)) !== record.phoneHash
    )
      fail(
        403,
        "You can only search the phone number verified in this session.",
      );
    if (path === "/check" && req.body?.service === "instagram")
      fail(
        403,
        "Instagram searches are locked until ownership of that Instagram account is verified. Phone OTP alone cannot prove it.",
      );
  }
  return { state, send, verify, requireVerified };
}
