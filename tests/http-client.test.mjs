import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON } from '../shared/http-client.js';

test('JSON client preserves authentication, consent, and safe server errors without retries', async () => {
  let calls = 0;
  const fetcher = async (path, options) => {
    calls++; assert.equal(path, '/api/osint/check');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { consent: true });
    return Response.json({ error: 'Verify your authenticator before checking exposure.' }, { status: 403 });
  };
  await assert.rejects(requestJSON('/api/osint/check', { method: 'POST', body: { consent: true }, fetcher }), error => error.status === 403 && /authenticator/.test(error.message));
  assert.equal(calls, 1);
});
test('JSON client bounds stalled requests and treats network/unreadable responses as failures', async () => {
  let aborted = false;
  const fetcher = (path, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
  await assert.rejects(requestJSON('/api/osint/check', { timeoutMs: 10, fetcher }), error => error.code === 'REQUEST_TIMEOUT');
  assert.equal(aborted, true);
  await assert.rejects(requestJSON('/api/health', { fetcher: async () => { throw new TypeError('private network details'); } }), error => error.code === 'NETWORK_UNAVAILABLE' && !error.message.includes('private'));
  for (const response of [new Response('<html>proxy debug secret</html>'), Response.json(null), Response.json([])])
    await assert.rejects(requestJSON('/api/health', { fetcher: async () => response }), error => error.code === 'INVALID_RESPONSE' && !error.message.includes('secret'));
});
test('JSON client accepts real JSON and rejects external destinations before sending data', async () => {
  assert.deepEqual(await requestJSON('/api/health', { fetcher: async () => Response.json({ ok: true }) }), { ok: true });
  let called = false;
  for (const path of ['https://example.org/api/check', '//example.org/api/check', '/api/\\example.org', '/api/../private', '/api//other'])
    await assert.rejects(requestJSON(path, { fetcher: async () => { called = true; } }));
  assert.equal(called, false);
});
