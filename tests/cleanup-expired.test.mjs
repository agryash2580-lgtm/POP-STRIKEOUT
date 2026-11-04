import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupExpired, isExpiredRecord, GRACE_MS } from '../scripts/cleanup-expired.mjs';
import { read, write, remove } from '../api/store.mjs';
import { randomUUID } from 'node:crypto';

async function* keys(values) { for (const value of values) yield value; }

test('cleanup only considers known, genuinely expired authentication records', async () => {
  const now = 2 * GRACE_MS;
  const records = new Map([
    ['sessions/old', { expires: now - GRACE_MS, _etag: 'old' }],
    ['sessions/active', { expires: now + 1, _etag: 'active' }],
    ['mfa_challenges/recent', { expires: now - GRACE_MS + 1, _etag: 'recent' }],
    ['oauth_states/bad', { expires: 'yesterday', _etag: 'bad' }],
    ['osint_domains/old', { expires: 0, _etag: 'domain-old' }],
    ['osint_domains/active', { expires: now + 1, _etag: 'domain-active' }],
    ['users/old', { expires: 0, _etag: 'user' }],
  ]);
  const deleted = [];
  const options = { keys: keys(records.keys()), readRecord: async key => records.get(key),
    deleteRecord: async key => { deleted.push(key); return true; }, now };
  const preview = await cleanupExpired(options);
  assert.deepEqual(preview, { scanned: 6, eligible: 2, deleted: 0,
    changed: 0, errors: 0, applied: false, graceHours: 24 });
  assert.deepEqual(deleted, []);
  const applied = await cleanupExpired({ ...options, keys: keys(records.keys()), apply: true });
  assert.equal(applied.deleted, 2);
  assert.deepEqual(deleted, ['sessions/old', 'osint_domains/old']);
  assert.equal(isExpiredRecord({ expires: now - GRACE_MS + 1 }, now), false);
});

test('cleanup preserves a record changed after the first read', async () => {
  let reads = 0, deletes = 0;
  const result = await cleanupExpired({ keys: keys(['pop-pair/one']), now: 2 * GRACE_MS,
    apply: true, readRecord: async () => (++reads === 1
      ? { expires: 0, _etag: 'before' } : { expires: 0, _etag: 'after' }),
    deleteRecord: async () => { deletes++; return true; } });
  assert.equal(result.changed, 1);
  assert.equal(result.deleted, 0);
  assert.equal(deletes, 0);
});

test('one unreadable record does not stop cleanup of other expired records', async () => {
  const result = await cleanupExpired({ keys: keys(['sessions/bad', 'pop-sessions/good']),
    now: 2 * GRACE_MS, apply: true,
    readRecord: async key => {
      if (key === 'sessions/bad') throw Error('corrupt');
      return { expires: 0, _etag: 'good' };
    }, deleteRecord: async () => true });
  assert.equal(result.errors, 1);
  assert.equal(result.deleted, 1);
});

test('local storage cleanup removes only a disposable expired fixture', async () => {
  const expired = 'oauth_states/' + randomUUID();
  const active = 'oauth_states/' + randomUUID();
  await write(expired, { expires: Date.now() - 2 * GRACE_MS });
  await write(active, { expires: Date.now() + GRACE_MS });
  try {
    const result = await cleanupExpired({ keys: keys([expired, active]),
      readRecord: read, deleteRecord: async key => { await remove(key); return true; },
      apply: true });
    assert.equal(result.deleted, 1);
    assert.equal(await read(expired), null);
    assert.ok(await read(active));
  } finally {
    await remove(expired);
    await remove(active);
  }
});
