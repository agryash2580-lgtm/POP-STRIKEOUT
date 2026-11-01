import express from "express";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { read, write, remove, hash, createIfMissing } from "./store.mjs";
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
const securityKey = (id) => "account_security/" + id;
const cookieName = "strikeout_mfa";
const cookieOptions = () => ({
  httpOnly: true,
  secure: !!process.env.VERCEL,
  sameSite: "lax",
  path: "/api/auth/mfa",
  maxAge: 5 * 60000,
});
function encryptionKey() {
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) fail(503, "Authenticator setup is not configured.");
  return key;
}
function encrypt(secret) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((x) => x.toString("base64"))
    .join(".");
}
function decrypt(value) {
  const [iv, tag, data] = value.split(".").map((x) => Buffer.from(x, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
function authenticator(secret, label = "STRIKEOUT") {
  return new OTPAuth.TOTP({
    issuer: "STRIKEOUT",
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}
export async function securityState(id) {
  return (await read(securityKey(id))) || { enabled: false, version: 0 };
}
export async function startLogin(res, id, issueSession) {
  const security = await securityState(id);
  if (!security.enabled) {
    await issueSession(res, id, security.version || 0);
    return { mfaRequired: false };
  }
  const token = randomBytes(32).toString("hex");
  await write("mfa_challenges/" + hash(token), {
    userId: id,
    version: security.version,
    expires: Date.now() + 5 * 60000,
  });
  res.clearCookie("strikeout_session", { path: "/" });
  res.cookie(cookieName, token, cookieOptions());
  return { mfaRequired: true };
}
function pendingToken(req) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || ""
  );
}
async function pending(req) {
  const token = pendingToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await read("mfa_challenges/" + hash(token));
  return record?.expires > Date.now()
    ? { ...record, key: "mfa_challenges/" + hash(token) }
    : null;
}
async function consumeCode(id, code) {
  const s = await securityState(id);
  if (!s.enabled) fail(409, "MFA settings changed. Sign in again.");
  if (s.lockedUntil > Date.now())
    fail(
      429,
      "Too many incorrect codes. Wait five minutes before trying again.",
    );
  code = String(code || "")
    .replace(/[\s-]/g, "")
    .toLowerCase();
  let valid = false;
  if (/^[a-f0-9]{20}$/.test(code)) {
    const index = (s.recoveryHashes || []).indexOf(hash(code));
    if (index >= 0) {
      s.recoveryHashes.splice(index, 1);
      valid = true;
    }
  } else if (/^\d{6}$/.test(code)) {
    const delta = authenticator(decrypt(s.secret)).validate({
      token: code,
      window: 1,
    });
    const step = Math.floor(Date.now() / 30000) + (delta || 0);
    if (delta !== null && step > (s.lastStep ?? -1)) {
      s.lastStep = step;
      valid = true;
    }
  }
  if (!valid) {
    s.failed = (s.failed || 0) + 1;
    if (s.failed >= 5) {
      s.lockedUntil = Date.now() + 5 * 60000;
      s.failed = 0;
    }
    await write(securityKey(id), s, s._etag);
    fail(
      401,
      "Code invalid or already used. Wait for a new code, or use a recovery code.",
    );
  }
  s.failed = 0;
  s.lockedUntil = 0;
  await write(securityKey(id), s, s._etag);
  return s;
}
export function installMFA(app, { user, guarded, limited, issueSession }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/pending",
    guarded(async (req, res) => res.json({ pending: !!(await pending(req)) })),
  );
  router.post(
    "/cancel",
    guarded(async (req, res) => {
      const p = await pending(req);
      if (p) await remove(p.key);
      res.clearCookie(cookieName, cookieOptions());
      res.json({ ok: true });
    }),
  );
  router.post(
    "/verify",
    guarded(async (req, res) => {
      const p = await pending(req);
      if (!p) fail(401, "Your sign-in challenge expired. Sign in again.");
      limited({ ip: p.userId, headers: {} }, "mfa-verify", 10);
      const s = await securityState(p.userId);
      if (s.version !== p.version)
        fail(401, "Your security settings changed. Sign in again.");
      await consumeCode(p.userId, req.body.code);
      await remove(p.key);
      res.clearCookie(cookieName, cookieOptions());
      await issueSession(res, p.userId, s.version);
      res.json({ ok: true });
    }),
  );
  router.get(
    "/status",
    guarded(async (req, res) => {
      const owner = await user(req),
        s = await securityState(owner.id);
      res.json({
        enabled: !!s.enabled,
        configured: !!process.env.MFA_ENCRYPTION_KEY,
        recoveryRemaining: s.recoveryHashes?.length || 0,
        sso: owner.authProvider === "google",
      });
    }),
  );
  router.post(
    "/setup",
    guarded(async (req, res) => {
      const owner = await user(req);
      if (owner.guest)
        fail(400, "Create a permanent account before setting up MFA.");
      limited({ ip: owner.id, headers: {} }, "mfa-setup", 3);
      if (Date.now() - (req.strikeoutAuthSession?.issuedAt || 0) > 10 * 60000)
        fail(
          403,
          "Sign out and sign in again before changing account security.",
        );
      await createIfMissing(securityKey(owner.id), {
        enabled: false,
        version: 0,
      });
      const s = await securityState(owner.id);
      if (s.enabled) fail(409, "MFA is already enabled.");
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      const uri = authenticator(
        secret,
        owner.displayName || owner.username,
      ).toString();
      await write("mfa_enrollment/" + owner.id, {
        secret: encrypt(secret),
        expires: Date.now() + 5 * 60000,
      });
      res.json({
        secret,
        qr: await QRCode.toDataURL(uri),
        expiresInSeconds: 300,
      });
    }),
  );
  router.post(
    "/enable",
    guarded(async (req, res) => {
      const owner = await user(req),
        enrollment = await read("mfa_enrollment/" + owner.id);
      limited({ ip: owner.id, headers: {} }, "mfa-enroll", 6);
      if (!enrollment || enrollment.expires < Date.now())
        fail(400, "Setup expired. Start again.");
      const old = await securityState(owner.id);
      if (old.enabled) fail(409, "MFA is already enabled.");
      const code = String(req.body.code || "").trim();
      const delta = authenticator(decrypt(enrollment.secret)).validate({
        token: code,
        window: 1,
      });
      if (!/^\d{6}$/.test(code) || delta === null)
        fail(
          400,
          "Enter the current six-digit code from your authenticator app.",
        );
      const recoveryCodes = Array.from({ length: 8 }, () =>
        randomBytes(10).toString("hex"),
      );
      const version = (old.version || 0) + 1;
      await write(
        securityKey(owner.id),
        {
          enabled: true,
          version,
          secret: enrollment.secret,
          lastStep: Math.floor(Date.now() / 30000) + delta,
          recoveryHashes: recoveryCodes.map(hash),
        },
        old._etag,
      );
      await remove("mfa_enrollment/" + owner.id);
      await issueSession(res, owner.id, version);
      res.json({ enabled: true, recoveryCodes });
    }),
  );
  router.post(
    "/disable",
    guarded(async (req, res) => {
      const owner = await user(req);
      limited({ ip: owner.id, headers: {} }, "mfa-disable", 6);
      await consumeCode(owner.id, req.body.code);
      const s = await securityState(owner.id);
      await write(
        securityKey(owner.id),
        { enabled: false, version: (s.version || 0) + 1 },
        s._etag,
      );
      await issueSession(res, owner.id, (s.version || 0) + 1);
      res.json({ enabled: false });
    }),
  );
  app.use("/api/auth/mfa", router);
}
export async function deleteMFA(id) {
  await remove(securityKey(id));
  await remove("mfa_enrollment/" + id);
}

export async function clearMfaChallenge(req, res) {
  const p = await pending(req);
  if (p) await remove(p.key);
  res.clearCookie(cookieName, cookieOptions());
}
