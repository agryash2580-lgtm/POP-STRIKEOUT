import test from 'node:test';
import assert from 'node:assert/strict';
import { domainOwnershipService, readProofFile } from '../api/osint/domain-ownership.mjs';
import { authenticatorAuthService } from '../api/osint/authenticator-auth.mjs';
import { osintRouter } from '../api/osint.mjs';
import { EventEmitter } from 'node:events';

function fixture() {
  const records = new Map();
  let clock = 10000, version = 1, calls = 0, txt = [], proofBody = null, httpsCalls = 0,
    proofAddress = { url: new URL('https://example.org/.well-known/strikeout-verify.txt'), address: '8.8.8.8', family: 4 };
  const store = {
    async createIfMissing(key, value) {
      if (records.has(key)) return false;
      records.set(key, { data: structuredClone(value), etag: 1 }); return true;
    },
    async read(key) {
      const record = records.get(key); if (!record) return null;
      const value = structuredClone(record.data);
      Object.defineProperty(value, '_etag', { value: String(record.etag) });
      return value;
    },
    async write(key, value, etag) {
      const record = records.get(key);
      if (record && etag !== String(record.etag))
        throw Object.assign(Error('Conflict'), { status: 409 });
      records.set(key, { data: structuredClone(value), etag: (record?.etag || 0) + 1 });
    },
  };
  const security = async () => ({ enabled: true, version });
  const domains = domainOwnershipService({
    store, security, now: () => clock,
    random: () => 'a'.repeat(48),
    resolve: async name => { calls++; assert.equal(name, '_strikeout-verify.example.org'); return txt; },
    resolveAddress: async url => { httpsCalls++; assert.equal(url, 'https://example.org/.well-known/strikeout-verify.txt'); return proofAddress; },
    readFile: async (domain, resolved) => { assert.equal(domain, 'example.org'); assert.equal(resolved, proofAddress); return proofBody; },
  });
  const req = { osintUser: { id: 'owner' }, headers: { cookie: 'strikeout_session=session' }, path: '/dorks' };
  return { store, domains, req,
    setTxt: value => { txt = [[value]]; },
    setHttps: value => { proofBody = value; },
    setProofAddress: value => { proofAddress = value; },
    clock: delta => { clock += delta; },
    version: () => { version++; },
    get calls() { return calls; },
    get httpsCalls() { return httpsCalls; },
  };
}

test('domain proof needs a matching DNS TXT record and is scoped to exact domain and account', async () => {
  const f = fixture();
  await assert.rejects(f.domains.requireOwned(f.req, 'example.org'), { status: 403 });
  const pending = await f.domains.challenge(f.req, 'EXAMPLE.ORG');
  assert.equal(pending.domain, 'example.org');
  assert.equal(pending.pending.name, '_strikeout-verify.example.org');
  assert.match(pending.pending.value, /^strikeout-verification=[a-f0-9]{48}$/);
  assert.deepEqual(await f.domains.challenge(f.req, 'example.org'), pending);
  assert.equal(f.calls, 0);
  f.setTxt('wrong');
  await assert.rejects(f.domains.verify(f.req, 'example.org'), { status: 409 });
  f.setTxt(pending.pending.value);
  const proved = await f.domains.verify(f.req, 'example.org');
  assert.equal(proved.verified, true);
  assert.equal(proved.pending, null);
  await f.domains.requireOwned(f.req, 'example.org');
  await assert.rejects(f.domains.requireOwned(f.req, 'sub.example.org'), { status: 403 });
  await assert.rejects(f.domains.requireOwned({ ...f.req, osintUser: { id: 'other' } }, 'example.org'), { status: 403 });
  f.version();
  await assert.rejects(f.domains.requireOwned(f.req, 'example.org'), { status: 403 });
});

test('domain challenges and proofs expire and can be revoked', async () => {
  const f = fixture();
  const pending = await f.domains.challenge(f.req, 'example.org');
  f.clock(30 * 60 * 1000 + 1);
  await assert.rejects(f.domains.verify(f.req, 'example.org'), { status: 409 });
  const again = await f.domains.challenge(f.req, 'example.org');
  assert.equal(again.pending.expires > pending.pending.expires, true);
  f.setTxt(again.pending.value);
  await f.domains.verify(f.req, 'example.org');
  await f.domains.revoke(f.req, 'example.org');
  await assert.rejects(f.domains.requireOwned(f.req, 'example.org'), { status: 403 });
  const fresh = await f.domains.challenge(f.req, 'example.org');
  f.setTxt(fresh.pending.value);
  await f.domains.verify(f.req, 'example.org');
  f.clock(7 * 24 * 60 * 60 * 1000 + 1);
  await assert.rejects(f.domains.requireOwned(f.req, 'example.org'), { status: 403 });
});

test('HTTPS proof verifies exact-host content without DNS TXT and still expires', async () => {
  const f = fixture();
  const pending = await f.domains.challenge(f.req, 'example.org');
  assert.equal(pending.pending.https.url, 'https://example.org/.well-known/strikeout-verify.txt');
  assert.equal(pending.pending.https.value, pending.pending.value);
  f.setHttps('wrong');
  await assert.rejects(f.domains.verify(f.req, 'example.org', 'https'), { status: 409 });
  f.setHttps(pending.pending.value + '\n');
  const proof = await f.domains.verify(f.req, 'example.org', 'https');
  assert.equal(proof.verified, true);
  assert.equal(f.calls, 0);
  assert.equal(f.httpsCalls, 2);
  await f.domains.requireOwned(f.req, 'example.org');
  f.clock(7 * 24 * 60 * 60 * 1000 + 1);
  await assert.rejects(f.domains.requireOwned(f.req, 'example.org'), { status: 403 });
});

test('HTTPS proof rejects private DNS, redirects and unsupported methods', async () => {
  const f = fixture();
  await f.domains.challenge(f.req, 'example.org');
  await assert.rejects(f.domains.verify(f.req, 'example.org', 'web'), { status: 400 });
  f.setProofAddress(null);
  f.setHttps(null);
  await assert.rejects(f.domains.verify(f.req, 'example.org', 'https'), { status: 409 });
  const privateAddress = Object.assign(Error('Private hostname'), { status: 400 });
  const domains = domainOwnershipService({ store: f.store,
    security: async () => ({ enabled: true, version: 1 }), now: () => 10000,
    resolveAddress: async () => { throw privateAddress; },
    readFile: async () => { throw Error('Must not fetch'); } });
  await assert.rejects(domains.verify(f.req, 'example.org', 'https'), { status: 409 });
});

test('HTTPS proof reader pins the public address and never follows redirects', async () => {
  let options;
  function fakeRequest(input, respond) {
    options = input;
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = () => queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      response.resume = () => {};
      respond(response);
      response.emit('data', Buffer.from('strikeout-verification=abc'));
      response.emit('end');
    });
    return req;
  }
  const body = await readProofFile('example.org', { address: '8.8.8.8', family: 4 }, { request: fakeRequest });
  assert.equal(body, 'strikeout-verification=abc');
  assert.equal(options.hostname, 'example.org');
  assert.equal(options.servername, 'example.org');
  assert.equal(options.path, '/.well-known/strikeout-verify.txt');
  assert.equal(options.agent, false);
  options.lookup('example.org', {}, (error, address, family) => {
    assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
  });
  options.lookup('example.org', { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
  });
  let redirectRequests = 0;
  const redirected = await readProofFile('example.org', { address: '8.8.8.8', family: 4 }, {
    request: (_input, respond) => {
      redirectRequests++;
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.end = () => queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = 302;
        response.resume = () => {};
        respond(response);
      });
      return req;
    },
  });
  assert.equal(redirected, null);
  assert.equal(redirectRequests, 1);
});

test('invalid domains never reach DNS or storage', async () => {
  const f = fixture();
  for (const domain of ['localhost', '127.0.0.1', 'example.org/path', 'example.org:443',
    'example.org OR site:other.org', 'example.test', 'a'.repeat(236) + '.org'])
    await assert.rejects(f.domains.challenge(f.req, domain), { status: 400 });
  assert.equal(f.calls, 0);
});

test('MFA gate and domain proof both precede provider search', async () => {
  const f = fixture();
  const auth = authenticatorAuthService({
    store: f.store, domains: f.domains, now: () => 10000,
    security: async () => ({ enabled: true, version: 1 }),
    configured: () => true,
    consume: async () => ({ enabled: true, version: 1 }),
  });
  const guarded = fn => async (req, res, next) => {
    try { await fn(req, res, next); } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  };
  const router = osintRouter({
    user: async () => ({ id: 'owner' }), guarded, limited: () => {},
    domainOwnership: f.domains, exposureAuth: auth,
    imageOptions: { env: { SERPAPI_API_KEY: 'fixture-key' },
      resolver: async () => [{ address: '8.8.8.8', family: 4 }],
      fetcher: async url => {
        assert.equal(url.hostname, 'serpapi.com');
        return Response.json({ search_metadata: { status: 'Success' },
          exact_matches: [{ link: 'https://example.org/copy', title: 'Public copy' }] });
      } },
    searchOptions: { env: { SERPAPI_API_KEY: 'fixture-key' }, fetcher: async url => {
      assert.equal(url.hostname, 'serpapi.com');
      return Response.json({ search_metadata: { status: 'Success' }, organic_results: [
        { link: 'https://example.org/public.pdf', title: 'me@example.org', snippet: 'A public reference' },
        { link: 'https://other.org/public.pdf', title: 'me@example.org', snippet: 'Out of scope' },
      ] });
    } },
  });
  function send(path, body, method = 'POST') {
    return new Promise(resolve => {
      const req = { method, url: path, headers: f.req.headers, body,
        query: Object.fromEntries(new URL('http://local' + path).searchParams) };
      const res = { statusCode: 200, status(n) { this.statusCode = n; return this; },
        json(value) { resolve({ status: this.statusCode, value }); } };
      router(req, res, () => resolve({ status: 404 }));
    });
  }
  const body = { domain: 'example.org', identifier: 'me@example.org', templates: ['pdf'],
    mode: 'handoff', consent: { selfOwned: true, version: '1', providers: ['google_search'] } };
  assert.equal((await send('/dorks', body)).status, 403);
  const image = { imageUrl: 'https://example.org/photo.png', mode: 'handoff',
    consent: { selfOwned: true, version: '1', providers: ['google_lens'] } };
  assert.equal((await send('/images/reverse', image)).status, 403);
  assert.equal((await send('/domains/challenge', { domain: 'example.org' })).status, 403);
  await auth.verify({ ...f.req, body: { code: '123456' } });
  assert.equal((await send('/dorks', body)).status, 403);
  const pending = await send('/domains/challenge', { domain: 'example.org' });
  assert.equal(pending.status, 200);
  const status = await send('/domains/status?domain=example.org', undefined, 'GET');
  assert.equal(status.status, 200);
  assert.equal(status.value.pending.value, pending.value.pending.value);
  f.setTxt(pending.value.pending.value);
  assert.equal((await send('/domains/verify', { domain: 'example.org' })).status, 200);
  const result = await send('/dorks', body);
  assert.equal(result.status, 200);
  assert.equal(result.value.status, 'requires_user_search');
  assert.equal(result.value.handoffs.length, 1);
  const automatic = await send('/dorks', { ...body, mode: 'api',
    consent: { selfOwned: true, version: '1', providers: ['serpapi'] } });
  assert.equal(automatic.status, 200);
  assert.equal(automatic.value.status, 'completed');
  assert.equal(automatic.value.findings.length, 1);
  assert.equal(automatic.value.findings[0].url, 'https://example.org/public.pdf');
  const imageResult = await send('/images/reverse', image);
  assert.equal(imageResult.status, 200);
  assert.equal(imageResult.value.status, 'requires_user_search');
  assert.equal(imageResult.value.handoff.provider, 'google_lens');
  const imageAutomatic = await send('/images/reverse', { ...image, mode: 'api',
    consent: { selfOwned: true, version: '1', providers: ['serpapi'] } });
  assert.equal(imageAutomatic.status, 200);
  assert.equal(imageAutomatic.value.status, 'completed');
  assert.equal(imageAutomatic.value.findings.length, 1);
  assert.equal((await send('/dorks', { ...body, domain: 'other.org' })).status, 403);
  assert.equal((await send('/images/reverse', { ...image, imageUrl: 'https://other.org/photo.png' })).status, 403);
  assert.equal((await send('/domains/revoke', { domain: 'example.org' })).status, 200);
  assert.equal((await send('/dorks', body)).status, 403);
  const webPending = await send('/domains/challenge', { domain: 'example.org' });
  f.setHttps(webPending.value.pending.value);
  assert.equal((await send('/domains/verify', { domain: 'example.org', method: 'https' })).status, 200);
  assert.equal((await send('/dorks', body)).status, 200);
});
