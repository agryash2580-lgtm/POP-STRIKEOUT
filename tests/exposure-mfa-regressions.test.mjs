import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import app from "../api/index.mjs";
for (const [label, key, expected] of [
  ["missing encryption key", undefined, false],
  ["invalid base64 key", "not-a-key", false],
  ["short encryption key", randomBytes(16).toString("base64"), false],
  ["oversized encryption key", randomBytes(33).toString("base64"), false],
  ["valid 32-byte encryption key", randomBytes(32).toString("base64"), true],
])
  test("MFA and exposure agree on configuration: " + label, async () => {
    const previous = process.env.MFA_ENCRYPTION_KEY;
    if (key === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = key;
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    let cookie;
    try {
      const started = await fetch(base + "/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      cookie = started.headers.get("set-cookie").split(";")[0];
      for (const path of ["/api/auth/mfa/status", "/api/osint/auth/status"]) {
        const r = await fetch(base + path, { headers: { cookie } });
        assert.equal(r.status, 200);
        const state = await r.json();
        assert.equal(state.configured, expected, path);
        assert.equal(state.enabled, false);
      }
      const malformed = await fetch(base + "/api/auth/mfa/disable", {
        method: "POST",
        headers: { cookie },
      });
      assert.equal(
        malformed.status,
        409,
        "missing request body must not crash the MFA handler",
      );
    } finally {
      if (cookie)
        await fetch(base + "/api/account", {
          method: "DELETE",
          headers: { cookie },
        });
      await new Promise((r) => server.close(r));
      if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
      else process.env.MFA_ENCRYPTION_KEY = previous;
    }
  });

test("old sessions explicitly request reauthentication and cannot start MFA enrollment", async () => {
  const { randomBytes } = await import("node:crypto");
  const { read, write, hash } = await import("../api/store.mjs");
  const previous = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie;
  try {
    const credentials = {
      username: "recent_" + randomBytes(5).toString("hex"),
      password: "Fictional-test-password-123!",
    };
    const registered = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(registered.status, 200);
    cookie = registered.headers.get("set-cookie").split(";")[0];
    const key = "sessions/" + hash(cookie.split("=")[1]);
    const record = await read(key);
    record.issuedAt = Date.now() - 11 * 60000;
    await write(key, record);
    const status = await fetch(base + "/api/auth/mfa/status", {
      headers: { cookie },
    });
    assert.equal((await status.json()).reauthenticationRequired, true);
    const setup = await fetch(base + "/api/auth/mfa/setup", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(setup.status, 403);
    assert.match((await setup.json()).error, /sign out and sign in/i);
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (
        await (
          await fetch(base + "/api/auth/mfa/status", { headers: { cookie } })
        ).json()
      ).reauthenticationRequired,
      false,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/mfa/setup", {
          method: "POST",
          headers: { cookie, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      200,
    );
  } finally {
    if (cookie)
      await fetch(base + "/api/account", {
        method: "DELETE",
        headers: { cookie },
      });
    await new Promise((r) => server.close(r));
    if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previous;
  }
});
