import test from "node:test";
import assert from "node:assert/strict";
import { authenticatorAuthService } from "../api/osint/authenticator-auth.mjs";
function fixture() {
  const records = new Map();
  let time = 10000,
    enabled = true,
    version = 1,
    configured = true,
    calls = 0,
    used = false;
  const store = {
    read: async (k) => records.get(k),
    write: async (k, v) => records.set(k, v),
  };
  const auth = authenticatorAuthService({
    store,
    now: () => time,
    configured: () => configured,
    security: async () => ({ enabled, version }),
    consume: async (id, code) => {
      calls++;
      if (code !== "123456" || used)
        throw Object.assign(Error("Invalid or reused code"), { status: 401 });
      used = true;
      return { enabled, version };
    },
  });
  const req = {
    osintUser: { id: "owner" },
    headers: { cookie: "strikeout_session=test-session" },
    path: "/check",
    body: { code: "123456" },
  };
  return {
    auth,
    req,
    get calls() {
      return calls;
    },
    advance: (ms) => (time += ms),
    disable: () => (enabled = false),
    changeVersion: () => version++,
    unconfigure: () => (configured = false),
    verifiedEmail: (email) => records.set("analysis_email/owner", { email, verifiedAt: "2026-11-03T00:00:00.000Z" }),
  };
}
test("authenticator grants are scoped to account/session, expire, and contain no codes", async () => {
  const f = fixture();
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  assert.equal((await f.auth.verify(f.req)).verified, true);
  f.verifiedEmail("owner@example.org");
  await f.auth.requireVerified({ ...f.req, body: { service: "email", input: { email: "OWNER@example.org" } } });
  assert.equal(
    (await f.auth.state({ ...f.req, osintUser: { id: "another" } })).verified,
    false,
  );
  assert.equal(
    (
      await f.auth.state({
        ...f.req,
        headers: { cookie: "strikeout_session=another" },
      })
    ).verified,
    false,
  );
  f.advance(1800001);
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
});
test("disabling MFA, changing security version or losing encryption config revokes grants", async () => {
  for (const action of ["disable", "changeVersion", "unconfigure"]) {
    const f = fixture();
    await f.auth.verify(f.req);
    f[action]();
    await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  }
});
test("code verification reuses replay-protected account MFA and rejects recovery/SMS-style input", async () => {
  const f = fixture();
  f.req.body = { code: "recoverycode" };
  await assert.rejects(f.auth.verify(f.req), { status: 400 });
  assert.equal(f.calls, 0);
  f.req.body = { code: "000000" };
  await assert.rejects(f.auth.verify(f.req), { status: 401 });
  assert.equal((await f.auth.state(f.req)).verified, false);
  f.req.body = { code: "123456" };
  await f.auth.verify(f.req);
  await assert.rejects(f.auth.verify(f.req), { status: 401 });
});
test("free authenticator is not treated as proof of phone or Instagram ownership, including route variants", async () => {
  const f = fixture();
  await f.auth.verify(f.req);
  for (const path of ["/check", "/check/", "/CHECK/"])
    for (const service of ["phone", "instagram", "linkedin", "identity_cards"])
      await assert.rejects(
        f.auth.requireVerified({ ...f.req, path, body: { service } }),
        { status: 403 },
      );
});
test("personal searches require an exact verified email or remain locked", async () => {
  const f = fixture();
  await f.auth.verify(f.req);
  const search = (email) => f.auth.requireVerified({ ...f.req, path: "/check", body: { service: "email", input: { email } } });
  await assert.rejects(search("owner@example.org"), { status: 403 });
  f.verifiedEmail("owner@example.org");
  await search("OWNER@example.org");
  await assert.rejects(search("other@example.org"), { status: 403 });
  await assert.rejects(f.auth.requireVerified({ ...f.req, path: "/dorks", body: { domain: "example.org" } }), { status: 403 });
  await assert.rejects(f.auth.requireVerified({ ...f.req, path: "/images/reverse", body: { imageUrl: "https://example.org/photo.png" } }), { status: 403 });
});
test("every mounted exposure endpoint enforces authenticator before provider work", async () => {
  const { osintRouter } = await import("../api/osint.mjs");
  const f = fixture();
  const guarded = (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  };
  const router = osintRouter({
    user: async () => ({ id: "owner" }),
    guarded,
    limited: () => {},
    exposureAuth: f.auth,
  });
  const send = (path) =>
    new Promise((resolve) => {
      const req = {
        method: "POST",
        url: path,
        headers: f.req.headers,
        body: {},
      };
      const res = {
        statusCode: 200,
        status(n) {
          this.statusCode = n;
          return this;
        },
        json(value) {
          resolve({ status: this.statusCode, value });
        },
      };
      router(req, res, () => resolve({ status: 404 }));
    });
  for (const path of [
    "/check",
    "/dorks",
    "/images/reverse",
    "/review-documents",
    "/passwords/range",
    "/links/assess",
  ])
    assert.equal((await send(path)).status, 403, path);
  assert.equal(f.calls, 0);
});

test("real encrypted TOTP setup unlocks exposure, rejects replay, and disabling MFA revokes access", async () => {
  const { default: app } = await import("../api/index.mjs");
  const { randomBytes } = await import("node:crypto");
  const { write } = await import("../api/store.mjs");
  const OTPAuth = await import("otpauth");
  const previous = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const jar = new Map();
  let owner;
  async function call(path, body, method) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(";"),
        at = pair.indexOf("=");
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return { status: r.status, data: await r.json() };
  }
  try {
    const credentials = {
      username: "free_otp_" + randomBytes(6).toString("hex"),
      password: "Fictional-test-password-123!",
    };
    const registered = await call("/api/auth/register", credentials);
    assert.equal(registered.status, 200);
    owner = registered.data.user;
    assert.equal((await call("/api/osint/auth/status")).data.verified, false);
    assert.equal((await call("/api/osint/review-documents", {})).status, 403);
    const setup = await call("/api/auth/mfa/setup", {});
    assert.equal(setup.status, 200);
    const otp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(setup.data.secret),
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    });
    const enrollmentCode = otp.generate();
    const enabled = await call("/api/auth/mfa/enable", {
      code: enrollmentCode,
    });
    assert.equal(enabled.status, 200);
    assert.equal(
      (await call("/api/osint/auth/verify", { code: enrollmentCode })).status,
      401,
    );
    const fresh = otp.generate({ timestamp: Date.now() + 30000 });
    assert.equal(
      (await call("/api/osint/auth/verify", { code: fresh })).data.verified,
      true,
    );
    assert.equal(
      (await call("/api/osint/auth/verify", { code: fresh })).status,
      401,
    );
    const report = await call("/api/osint/review-documents", {
      identifiers: { emails: ["demo@example.org"] },
      documents: [{ text: "demo@example.org password=FictionalSecret" }],
      consent: { selfOwned: true, version: "1" },
    });
    assert.equal(report.status, 200);
    assert.ok(!JSON.stringify(report.data).includes("FictionalSecret"));
    assert.equal(
      (await call("/api/osint/check", { service: "instagram" })).status,
      403,
    );
    const emailCheck = (email) => call("/api/osint/check", {
      service: "email", input: { email },
      consent: { selfOwned: true, version: "1", providers: [] },
    });
    assert.equal((await emailCheck("owner@example.org")).status, 403);
    await write("analysis_email/" + owner.id, { email: "owner@example.org", verifiedAt: new Date().toISOString() });
    assert.equal((await emailCheck("other@example.org")).status, 403);
    const owned = await emailCheck("OWNER@example.org");
    assert.equal(owned.status, 400);
    assert.match(owned.data.error, /Select an approved provider/);
    assert.equal((await call("/api/osint/dorks", { domain: "example.org" })).status, 403);
    assert.equal((await call("/api/osint/images/reverse", { imageUrl: "https://example.org/photo.png" })).status, 403);
    assert.equal((await call("/api/search/github", { username: "someoneelse", approved: true })).status, 403);
    assert.equal(
      (
        await call("/api/auth/mfa/disable", {
          code: enabled.data.recoveryCodes[0],
        })
      ).status,
      200,
    );
    assert.equal((await call("/api/osint/auth/status")).data.verified, false);
    assert.equal((await call("/api/osint/review-documents", {})).status, 403);
  } finally {
    if (owner) await call("/api/account", undefined, "DELETE");
    await new Promise((r) => server.close(r));
    if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previous;
  }
});

test("exposure rejection asks for a fresh TOTP rather than an unsupported recovery code", async () => {
  const f = fixture();
  f.req.body = { code: "000000" };
  await assert.rejects(
    f.auth.verify(f.req),
    (error) =>
      error.status === 401 &&
      /next six-digit code/.test(error.message) &&
      !/recovery/i.test(error.message),
  );
});
