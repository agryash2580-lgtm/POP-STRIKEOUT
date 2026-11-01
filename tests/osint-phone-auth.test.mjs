import test from "node:test";
import assert from "node:assert/strict";
import { phoneAuthService } from "../api/osint/phone-auth.mjs";
function fixture() {
  let time = 1000000,
    calls = 0;
  const records = new Map();
  const store = {
    read: async (k) =>
      records.has(k) ? structuredClone(records.get(k)) : null,
    write: async (k, v) => records.set(k, structuredClone(v)),
    createIfMissing: async (k, v) => {
      if (records.has(k)) return false;
      records.set(k, structuredClone(v));
      return true;
    },
  };
  const env = {
    TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
    TWILIO_VERIFY_SERVICE_SID: "VA" + "b".repeat(32),
    TWILIO_AUTH_TOKEN: "private-test-token",
    OSINT_PHONE_HASH_KEY: "private-test-hmac-key-32-characters",
  };
  const req = {
    osintUser: { id: "owner" },
    headers: { cookie: "strikeout_session=private-test-session" },
    ip: "127.0.0.1",
    path: "/check",
    body: { phone: "+12025550147", consent: true },
  };
  let answer = "approved";
  const auth = phoneAuthService({
    env,
    store,
    now: () => time,
    fetcher: async (url, opts) => {
      calls++;
      assert.ok(url.startsWith("https://verify.twilio.com/"));
      assert.equal(opts.redirect, "error");
      const form = new URLSearchParams(opts.body);
      const checking = url.endsWith("/VerificationCheck");
      if (checking) {
        assert.equal(form.get("VerificationSid"), "VE" + "c".repeat(32));
        assert.ok(form.get("Code"));
      } else {
        assert.equal(form.get("To"), "+12025550147");
        assert.equal(form.get("Channel"), "sms");
      }
      return Response.json({
        sid: "VE" + "c".repeat(32),
        channel: "sms",
        to: "+12025550147",
        status: checking ? answer : "pending",
      });
    },
  });
  return {
    auth,
    req,
    records,
    store,
    env,
    get calls() {
      return calls;
    },
    advance: (ms) => (time += ms),
    answer: (x) => (answer = x),
  };
}
async function approve(f) {
  await f.auth.send(f.req);
  f.req.body = { code: "123456" };
  await f.auth.verify(f.req);
}
test("OTP binds verification to account and login session, persists only HMAC/masked phone, and expires", async () => {
  const f = fixture();
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  await approve(f);
  assert.equal((await f.auth.state(f.req)).verified, true);
  assert.equal(
    (
      await f.auth.state({
        ...f.req,
        headers: { cookie: "strikeout_session=another" },
      })
    ).verified,
    false,
  );
  assert.equal(
    (await f.auth.state({ ...f.req, osintUser: { id: "other" } })).verified,
    false,
  );
  const saved = JSON.stringify([...f.records]);
  assert.ok(!saved.includes("+12025550147"));
  assert.ok(!saved.includes("123456"));
  assert.ok(!saved.includes("private-test-token"));
  f.req.body = { service: "phone", input: { phone: "+12025550147" } };
  await f.auth.requireVerified(f.req);
  f.req.body.input.phone = "+12025550148";
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  f.advance(1800001);
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
});
test("unconfigured SMS fails closed, including an otherwise verified record", async () => {
  const f = fixture();
  await approve(f);
  delete f.env.TWILIO_AUTH_TOKEN;
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  await assert.rejects(f.auth.send(f.req), { status: 503 });
});
test("wrong codes have bounded attempts and expired/replayed codes cannot grant verification", async () => {
  const f = fixture();
  await f.auth.send(f.req);
  f.req.body = { code: "123456" };
  f.answer("pending");
  for (let i = 0; i < 5; i++)
    await assert.rejects(f.auth.verify(f.req), { status: 400 });
  const before = f.calls;
  await assert.rejects(f.auth.verify(f.req), { status: 429 });
  assert.equal(f.calls, before);
  const g = fixture();
  await approve(g);
  await assert.rejects(g.auth.verify(g.req), { status: 400 });
  const h = fixture();
  await h.auth.send(h.req);
  h.advance(600001);
  h.req.body = { code: "123456" };
  await assert.rejects(h.auth.verify(h.req), { status: 400 });
});
test("SMS cooldown persists across service instances, requires consent and valid phone", async () => {
  const f = fixture();
  f.req.body.consent = false;
  await assert.rejects(f.auth.send(f.req), { status: 400 });
  assert.equal(f.calls, 0);
  f.req.body = { phone: "+12025550147", consent: true };
  await f.auth.send(f.req);
  await assert.rejects(f.auth.send(f.req), { status: 429 });
  assert.equal(f.calls, 1);
});
test("Instagram cannot be unlocked by verifying an unrelated phone", async () => {
  const f = fixture();
  await approve(f);
  f.req.body = { service: "instagram", input: { username: "someone_else" } };
  await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
});
test("provider failure or malformed approval never unlocks scans", async () => {
  const f = fixture();
  await f.auth.send(f.req);
  f.req.body = { code: "123456" };
  f.answer("fake-approved");
  await assert.rejects(f.auth.verify(f.req), { status: 400 });
  assert.equal((await f.auth.state(f.req)).verified, false);
});
test("every mounted exposure endpoint enforces OTP before input processing or provider work", async () => {
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
    phoneAuth: f.auth,
  });
  const send = (path) =>
    new Promise((resolve) => {
      const req = {
        method: "POST",
        url: path,
        headers: f.req.headers,
        body: {},
        ip: f.req.ip,
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

test("case and trailing slash variants do not bypass Instagram/phone ownership checks", async () => {
  const f = fixture();
  await approve(f);
  for (const path of ["/check/", "/CHECK", "/CHECK/"]) {
    f.req.path = path;
    f.req.body = { service: "instagram", input: { username: "someone_else" } };
    await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
    f.req.body = { service: "phone", input: { phone: "+12025550148" } };
    await assert.rejects(f.auth.requireVerified(f.req), { status: 403 });
  }
});
