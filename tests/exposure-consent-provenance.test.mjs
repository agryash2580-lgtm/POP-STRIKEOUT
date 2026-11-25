import test from "node:test";
import assert from "node:assert/strict";
import { runCheck, runPasswordRange } from "../api/osint/osint.mjs";
import { reviewDocuments } from "../api/osint/documents.mjs";
import { assessLinks } from "../api/osint/link-risk.mjs";
import { runDorks } from "../api/osint/dorks.mjs";
import { reverseImage } from "../api/osint/images.mjs";
import express from "express";
import { osintRouter } from "../api/osint.mjs";
import { authenticatorAuthService } from "../api/osint/authenticator-auth.mjs";

const approval = { selfOwned: true, version: "1" };
const email = "owner@example.org";
const target = { service: "email", input: { email } };

test("malformed provider consent is rejected before any lookup, including mixed valid/invalid entries", async () => {
  let disclosures = 0;
  const options = { env: { SERPAPI_API_KEY: "fixture", HIBP_API_KEY: "fixture", BRAVE_SEARCH_API_KEY: "fixture" },
    fetcher: async () => { disclosures++; return Response.json({ incomplete_results: false, items: [] }); },
    resolver: async () => { disclosures++; return [{ address: "8.8.8.8", family: 4 }]; } };
  for (const providers of ["github_public", "hibp", null, {}, ["github_public", null],
    ["hibp", 1], [""], ["github_public", "x".repeat(100)], Array(17).fill("github_public")]) {
    const consent = { ...approval, providers };
    for (const operation of [
      () => runCheck({ ...target, consent }, options),
      () => runPasswordRange({ prefix: "5BAA6", consent }, options),
      () => runDorks({ domain: "example.org", identifier: email, consent }, options),
      () => reverseImage({ imageUrl: "https://example.org/photo.png", consent }, options),
      () => reviewDocuments({ documents: [{ text: "Fictional example" }], consent }),
      () => assessLinks({ links: [{ url: "https://example.org" }], consent }),
    ]) await assert.rejects(async () => operation(), { status: 400 });
  }
  assert.equal(disclosures, 0);
});

test("consent is explicit on every operation and remains compatible with local-only review", async () => {
  for (const consent of [undefined, [], {}, { ...approval, selfOwned: "true" }, { ...approval, version: 1 }])
    await assert.rejects(runCheck({ ...target, consent }), { status: 400 });
  assert.equal(reviewDocuments({ documents: [{ text: "Fictional example" }], consent: approval }).status, "completed");
  assert.equal(assessLinks({ links: [{ url: "https://example.org" }], consent: approval }).networkRequests, false);
  let requests = 0;
  const result = await runCheck({ ...target, consent: { ...approval, providers: ["manual_web_handoff"] } }, {
    fetcher: async () => { requests++; throw Error("No request expected"); },
  });
  assert.equal(result.status, "requires_user_search");
  assert.equal(requests, 0);
});

test("password prefix rejects non-string, full-hash and raw-password input without disclosure", async () => {
  let requests = 0;
  for (const prefix of [12345, null, {}, "F".repeat(40), "FictionalPassword123!"])
    await assert.rejects(runPasswordRange({ prefix, consent: { ...approval, providers: ["pwned_passwords"] } }, {
      fetcher: async () => { requests++; throw Error("No request expected"); },
    }), { status: 400 });
  assert.equal(requests, 0);
});

test("Brave evidence is redacted and retains attribution alongside GitHub and HIBP", async () => {
  const duplicate = "https://github.com/example/project/issues/1";
  const calls = [];
  const result = await runCheck({ ...target, consent: { ...approval, providers: ["github_public", "brave", "hibp"] } }, {
    env: { HIBP_API_KEY: "fixture", BRAVE_SEARCH_API_KEY: "fixture" },
    fetcher: async endpoint => {
      const host = new URL(endpoint).hostname; calls.push(host);
      if (host === "haveibeenpwned.com") return Response.json([{ Name: "FictionalBreach", DataClasses: ["Email addresses"] }]);
      if (host === "api.github.com") return Response.json({ incomplete_results: false, items: [{ html_url: duplicate, body: email }] });
      assert.equal(host, "api.search.brave.com");
      return Response.json({ web: { results: [
        { url: duplicate, title: "Duplicate" },
        { url: "https://example.org/reference", title: "password=FictionalPrivateMarker",
          description: "api_key=FictionalApiMarker card 4111111111111111" },
      ] } });
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.findings.find(f => f.url === duplicate).providers, ["github_public", "brave"]);
  assert.deepEqual(result.findings.find(f => f.name === "FictionalBreach").providers, ["hibp"]);
  assert.equal(result.findings.find(f => f.url === "https://example.org/reference").provider, "brave");
  for (const privateValue of ["FictionalPrivateMarker", "FictionalApiMarker", "4111111111111111"])
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  assert.ok(result.findings.every(f => f.providers.every(p => typeof p === "string")));
});

test("mounted API requires session, MFA, exact email ownership and valid consent before selected provider work", async () => {
  const records = new Map();
  const store = { read: async key => records.get(key), write: async (key, value) => records.set(key, value) };
  const auth = authenticatorAuthService({ store, configured: () => true,
    security: async () => ({ enabled: true, version: 1 }),
    consume: async () => ({ enabled: true, version: 1 }) });
  const calls = [];
  const app = express(); app.use(express.json());
  app.use('/api/osint', osintRouter({
    user: async req => {
      if (req.headers.cookie !== 'strikeout_session=fixture-session')
        throw Object.assign(Error('Sign in'), { status: 401 });
      return { id: 'fixture-owner' };
    },
    guarded: fn => async (req, res, next) => {
      try { await fn(req, res, next); }
      catch (error) { res.status(error.status || 500).json({ error: error.message }); }
    },
    limited() {}, sharedLimit: async () => {}, exposureAuth: auth,
    checkOptions: { env: {}, fetcher: async endpoint => {
      calls.push(new URL(endpoint).hostname);
      return Response.json({ incomplete_results: false, items: [] });
    } },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function send(path, body, signedIn = true) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/osint' + path, {
      method: 'POST', headers: { 'content-type': 'application/json',
        ...(signedIn ? { cookie: 'strikeout_session=fixture-session' } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const check = { ...target, consent: { ...approval, providers: ['github_public'] } };
  try {
    assert.equal((await send('/check', check, false)).status, 401);
    assert.equal((await send('/check', check)).status, 403);
    assert.equal((await send('/auth/verify', { code: '123456' })).status, 200);
    assert.equal((await send('/check', check)).status, 403);
    records.set('analysis_email/fixture-owner', { email, verifiedAt: new Date().toISOString() });
    assert.equal((await send('/check', { ...check, input: { email: 'someone-else@example.org' } })).status, 403);
    for (const service of ['instagram', 'phone', 'linkedin', 'identity_cards'])
      assert.equal((await send('/CHECK/', { ...check, service })).status, 403);
    for (const providers of ['github_public', ['github_public', null]])
      assert.equal((await send('/check', { ...check, consent: { ...approval, providers } })).status, 400);
    assert.equal((await send('/check', { ...check, consent: { ...check.consent, selfOwned: false } })).status, 400);
    assert.deepEqual(calls, []);
    const completed = await send('/check', check);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status, 'completed');
    assert.deepEqual(calls, ['api.github.com']);
    assert.equal(completed.body.coverage[0].provider, 'github_public');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
