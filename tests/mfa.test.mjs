import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import app from "../api/index.mjs";
import { read, hash } from "../api/store.mjs";
test("authenticator MFA gates login, rejects replay, consumes recovery codes and invalidates old sessions and Pop tokens", async () => {
  const previous = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const jar = new Map();
  let owner;
  const cookies = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");
  async function call(path, body, extra = {}) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        cookie: cookies(),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of response.headers.getSetCookie()) {
      const pair = c.split(";")[0],
        i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: response.status, body: await response.json() };
  }
  const credentials = {
    username: "mfa_" + Date.now().toString(36),
    password: "Fictional-mfa-password-42",
  };
  try {
    const registered = await call("/api/auth/register", credentials);
    assert.equal(registered.status, 200);
    owner = registered.body.user;
    const oldCookie = cookies();
    const code = await call("/api/pop/connect-code", {});
    const pair = await call("/api/pop/pair", { code: code.body.code });
    const oldToken = pair.body.token;
    assert.ok(oldToken);
    const setup = await call("/api/auth/mfa/setup", {});
    assert.equal(setup.status, 200);
    assert.ok(setup.body.qr.startsWith("data:image/png"));
    const enrollment = await read("mfa_enrollment/" + owner.id);
    assert.ok(!enrollment.secret.includes(setup.body.secret));
    const otp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(setup.body.secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const first = otp.generate();
    const enabled = await call("/api/auth/mfa/enable", { code: first });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.recoveryCodes.length, 8);
    const recovery = enabled.body.recoveryCodes;
    const security = await read("account_security/" + owner.id);
    assert.equal(security.enabled, true);
    assert.ok(!JSON.stringify(security).includes(recovery[0]));
    assert.equal(
      (await call("/api/data", undefined, { cookie: oldCookie })).status,
      401,
    );
    assert.equal(
      (
        await call("/api/pop/conversation", undefined, {
          Authorization: "Bearer " + oldToken,
        })
      ).status,
      401,
    );
    await call("/api/auth/logout", {});
    await call("/api/auth/login", credentials);
    await call("/api/auth/logout", {});
    assert.equal((await call("/api/auth/mfa/pending")).body.pending, false);
    const login = await call("/api/auth/login", credentials);
    assert.equal(login.body.mfaRequired, true);
    assert.equal((await call("/api/data")).status, 401);
    assert.equal((await call("/api/auth/mfa/pending")).body.pending, true);
    assert.equal(
      (await call("/api/auth/mfa/verify", { code: "bad-code" })).status,
      401,
    );
    assert.equal(
      (await call("/api/auth/mfa/verify", { code: first })).status,
      401,
    );
    assert.equal(
      (await call("/api/auth/mfa/verify", { code: recovery[0] })).status,
      200,
    );
    assert.equal((await call("/api/data")).status, 200);
    assert.equal((await call("/api/auth/mfa/pending")).body.pending, false);
    await call("/api/auth/logout", {});
    await call("/api/auth/login", credentials);
    assert.equal(
      (await call("/api/auth/mfa/verify", { code: recovery[0] })).status,
      401,
    );
    const next = otp.generate({ timestamp: Date.now() + 30000 });
    assert.equal(
      (await call("/api/auth/mfa/verify", { code: next })).status,
      200,
    );
    assert.equal(
      (await call("/api/auth/mfa/disable", { code: recovery[1] })).status,
      200,
    );
    assert.equal((await call("/api/auth/mfa/status")).body.enabled, false);
    assert.equal(
      (await read("account_security/" + owner.id)).secret,
      undefined,
    );
  } finally {
    if (owner)
      await fetch(base + "/api/account", {
        method: "DELETE",
        headers: { cookie: cookies() },
      });
    if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previous;
    await new Promise((r) => server.close(r));
  }
});

test("Google SSO callback produces only an MFA challenge for an enrolled account", async () => {
  const { default: express } = await import("express");
  const { installGoogleAuth } = await import("../api/google-auth.mjs");
  const { startLogin } = await import("../api/mfa.mjs");
  const { write, remove } = await import("../api/store.mjs");
  const records = new Map();
  let nonce,
    issued = 0,
    challenge;
  const id = hash("google:fictional-mfa-google-subject");
  await write("account_security/" + id, { enabled: true, version: 1 });
  const serverApp = express();
  installGoogleAuth(serverApp, {
    env: {
      GOOGLE_CLIENT_ID: "fictional-client",
      GOOGLE_CLIENT_SECRET: "fictional-secret",
      GOOGLE_REDIRECT_URI: "http://localhost/callback",
    },
    guarded: (fn) => (req, res, next) =>
      Promise.resolve(fn(req, res)).catch(next),
    limited() {},
    fail(status, message) {
      throw Object.assign(Error(message), { status });
    },
    read: async (k) => records.get(k),
    write: async (k, v) => records.set(k, v),
    remove: async (k) => records.delete(k),
    hash,
    seed: () => ({}),
    session: (res, owner) =>
      startLogin(res, owner, async () => {
        issued++;
      }),
    createOAuthClient: () => ({
      generateAuthUrl: (options) => {
        nonce = options.nonce;
        return "https://accounts.google.com/?state=" + options.state;
      },
      getToken: async () => ({ tokens: { id_token: "fictional-token" } }),
      verifyIdToken: async () => ({
        getPayload: () => ({
          sub: "fictional-mfa-google-subject",
          nonce,
          email: "fictional@example.org",
          email_verified: true,
        }),
      }),
    }),
  });
  const server = serverApp.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const start = await fetch(base + "/api/auth/google/start", {
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location")).searchParams.get(
      "state",
    );
    const callback = await fetch(
      base + "/api/auth/google/callback?state=" + state + "&code=fictional",
      {
        redirect: "manual",
        headers: { cookie: start.headers.get("set-cookie").split(";")[0] },
      },
    );
    assert.equal(callback.headers.get("location"), "/");
    assert.equal(issued, 0);
    challenge = callback.headers
      .getSetCookie()
      .find((c) => c.startsWith("strikeout_mfa="))
      ?.split(";")[0]
      .split("=")[1];
    assert.ok(challenge);
    assert.equal((await read("mfa_challenges/" + hash(challenge))).userId, id);
  } finally {
    if (challenge) await remove("mfa_challenges/" + hash(challenge));
    await remove("account_security/" + id);
    await new Promise((r) => server.close(r));
  }
});
