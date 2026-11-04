import test from 'node:test';
import assert from 'node:assert/strict';
import { createDistributedLimiter } from '../api/osint/distributed-limit.mjs';
import { osintRouter } from '../api/osint.mjs';

function atomicStore() {
  const records = new Map();
  return {
    records,
    async createIfMissing(key, value) {
      if (records.has(key)) return false;
      records.set(key, { value: structuredClone(value), version: 1 });
      return true;
    },
    async read(key) {
      const record = records.get(key);
      return record && { ...structuredClone(record.value), _etag: String(record.version) };
    },
    async write(key, value, etag) {
      const record = records.get(key);
      if (!record || etag !== String(record.version))
        throw Object.assign(Error('conflict'), { code: 'STORAGE_CONFLICT' });
      records.set(key, { value: structuredClone(value), version: record.version + 1 });
    },
  };
}

test('shared exposure quota spans separate limiter instances and resets by minute', async () => {
  const store = atomicStore();
  let time = 1000;
  const first = createDistributedLimiter({ store, now: () => time });
  const second = createDistributedLimiter({ store, now: () => time });
  await first('private-account-id', 'osint', 2);
  await second('private-account-id', 'osint', 2);
  await assert.rejects(second('private-account-id', 'osint', 2),
    error => error.status === 429 && error.retryAfter === 59);
  assert.ok([...store.records.keys()].every(key => !key.includes('private-account-id')));
  await first('another-account', 'osint', 2);
  await first('private-account-id', 'exposure-auth', 2);
  time = 60_000;
  await first('private-account-id', 'osint', 2);
});

test('concurrent requests cannot exceed the shared quota', async () => {
  const store = atomicStore();
  const limit = createDistributedLimiter({ store, now: () => 1000 });
  const outcomes = await Promise.allSettled(Array.from({ length: 25 },
    () => limit('one-account', 'osint-domain-proof', 4)));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 4);
  assert.ok(outcomes.filter(result => result.status === 'rejected')
    .every(result => [429, 503].includes(result.reason.status)));
  assert.equal([...store.records.values()][0].value.count, 4);
});

test('storage conflicts and malformed quota records fail closed', async () => {
  const store = atomicStore();
  const limit = createDistributedLimiter({ store, now: () => 1000 });
  await limit('one-account', 'osint', 3);
  const key = [...store.records.keys()][0];
  store.records.get(key).value.count = 'invalid';
  await assert.rejects(limit('one-account', 'osint', 3), error => error.status === 503);
  store.records.get(key).value.count = 1;
  store.write = async () => { throw Object.assign(Error('conflict'), { code: 'STORAGE_CONFLICT' }); };
  await assert.rejects(limit('one-account', 'osint', 3), error => error.status === 503);
});

test('exposure routes consult the shared quota before doing provider or proof work', async () => {
  const calls = [];
  const guarded = fn => async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  };
  const router = osintRouter({
    user: async () => ({ id: 'owner' }), guarded, limited: () => {},
    exposureAuth: { requireVerified: async () => {}, verify: async () => { throw Error('MFA reached'); } },
    domainOwnership: { current: async () => { throw Error('DNS proof reached'); } },
    sharedLimit: async (identity, scope, max) => {
      calls.push({ identity, scope, max });
      throw tooManyForTest();
    },
  });
  async function send(method, url) {
    return new Promise(resolve => {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(value) { resolve({ status: this.statusCode, value }); } };
      router({ method, url, headers: {}, body: {} }, res, () => resolve({ status: 404 }));
    });
  }
  for (const [method, url] of [
    ['POST', '/auth/verify'], ['POST', '/check'], ['GET', '/domains/status'],
  ]) assert.equal((await send(method, url)).status, 429);
  assert.deepEqual(calls, [
    { identity: 'owner', scope: 'exposure-auth', max: 10 },
    { identity: 'owner', scope: 'osint', max: 12 },
    { identity: 'owner', scope: 'osint-domain-proof', max: 20 },
  ]);
});

function tooManyForTest() {
  return Object.assign(Error('quota reached'), { status: 429 });
}
