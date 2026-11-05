import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { reportsRouter } from '../api/reports.mjs';
import { osintRouter } from '../api/osint.mjs';
import { authenticatorAuthService } from '../api/osint/authenticator-auth.mjs';
import { read, write, remove, hash } from '../api/store.mjs';

async function fixture(run) {
  const owners = [randomUUID(), randomUUID()];
  const token = 'synthetic-email-test-session';
  const sent = [];
  let delivery = true;
  const mail = {
    configured: () => true,
    send: async message => {
      if (!delivery) throw Object.assign(Error('Email delivery unavailable.'), { status: 503 });
      sent.push(message); return { status: 'accepted' };
    },
  };
  const guarded = fn => async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  };
  const user = async req => ({ id: owners[req.headers['x-test-other'] ? 1 : 0], cases: [] });
  const app = express(); app.use(express.json());
  app.use('/api/reports', reportsRouter({ user, guarded, limited() {}, mail }));
  app.use('/api/osint', osintRouter({ user, guarded, limited() {},
    exposureAuth: authenticatorAuthService({
      security: async () => ({ enabled: true, version: 1 }), configured: () => true,
    }), sharedLimit: async () => {},
  }));
  for (const id of owners) await write('osint_authenticator/' + hash(id + ':' + token), {
    version: 1, expires: Date.now() + 60000,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function request(path, body, other = false) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', cookie: 'strikeout_session=' + token,
        ...(other ? { 'x-test-other': 'yes' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  const check = (email, other = false) => request('/api/osint/check', {
    service: 'email', input: { email },
    consent: { selfOwned: true, version: '1', providers: ['manual_web_handoff'] },
  }, other);
  try { await run({ request, check, sent, owners, failDelivery: () => { delivery = false; } }); }
  finally {
    await new Promise(resolve => server.close(resolve));
    for (const id of owners) {
      await remove('analysis_email/' + id);
      await remove('osint_authenticator/' + hash(id + ':' + token));
    }
  }
}

test('email code ownership unlocks only that exact email and account after MFA', async () => fixture(async ({ request, check, sent, owners }) => {
  assert.equal((await check('owner@example.org')).status, 403);
  const started = await request('/api/reports/email/verification', { email: 'OWNER@example.org' });
  assert.deepEqual(started, { status: 200, body: { sent: true, expiresInSeconds: 600 } });
  const code = sent[0].text.match(/\b\d{6}\b/)[0];
  const pending = await read('analysis_email/' + owners[0]);
  assert.ok(!Object.values(pending).includes(code));
  assert.equal((await check('owner@example.org')).status, 403);
  assert.equal((await request('/api/reports/email/confirm', { code }, true)).status, 400);
  assert.equal((await request('/api/reports/email/confirm', { code })).status, 200);
  const proof = await read('analysis_email/' + owners[0]);
  assert.equal(proof.codeHash, undefined); assert.equal(proof.salt, undefined);
  assert.equal((await check('OWNER@example.org')).body.status, 'requires_user_search');
  assert.equal((await check('different@example.org')).status, 403);
  assert.equal((await check('owner@example.org', true)).status, 403);
  assert.equal((await request('/api/reports/email/confirm', { code })).status, 400);
}));

test('email proof rejects expired and exhausted codes; delivery failure never claims success', async () => fixture(async ({ request, check, sent, owners, failDelivery }) => {
  await request('/api/reports/email/verification', { email: 'owner@example.org' });
  const code = sent[0].text.match(/\b\d{6}\b/)[0];
  for (let i = 0; i < 5; i++)
    assert.equal((await request('/api/reports/email/confirm', { code: '000000' })).status, 400);
  assert.equal((await request('/api/reports/email/confirm', { code })).status, 400);
  const key = 'analysis_email/' + owners[0];
  const pending = await read(key);
  await write(key, { ...pending, attempts: 0, expiresAt: Date.now() - 1 }, pending._etag);
  assert.equal((await request('/api/reports/email/confirm', { code })).status, 400);
  assert.equal((await check('owner@example.org')).status, 403);
  failDelivery();
  const failed = await request('/api/reports/email/verification', { email: 'other@example.org' }, true);
  assert.equal(failed.status, 503); assert.notEqual(failed.body.sent, true);
  assert.equal((await check('other@example.org', true)).status, 403);
}));
