import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDeployment } from '../scripts/check-deployment.mjs';
import { inspectStorage } from '../api/storage-health.mjs';

const files = {
  '/api/health': [JSON.stringify({ ok: true, version: '2.3.0', revision: 'abc123def456', storage: 'local-durable-files', storageRead: true }), 'application/json'],
  '/devfest.html': ['<html>SYNTHETIC DEMO<script src="/devfest-demo.js"></script></html>', 'text/html'],
  '/devfest.css': ['body{}', 'text/css'],
  '/devfest-demo.js': ['console.log("demo")', 'text/javascript'],
  '/devfest-fixtures.js': ['export const example = 1', 'text/javascript'],
};
function fetcher(overrides = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'manual');
    const [body, type] = files[url.pathname];
    return overrides[url.pathname] || new Response(body, { headers: { 'content-type': type } });
  };
}
test('deployment verifier requires public demo assets, healthy private storage and expected revision', async () => {
  const result = await checkDeployment('https://strikeout.example', {
    expectedSha: 'abc123def4567890', fetcher: fetcher(),
  });
  assert.equal(result.publicAssets, 4);
  assert.equal(result.visitorAccessible, true);
  assert.equal(result.revision, 'abc123def456');
  assert.equal(result.storageRead, true);
  await assert.rejects(checkDeployment('https://strikeout.example', {
    expectedStorage: 'private-durable-blob', fetcher: fetcher(),
  }), /working private-durable-blob storage read/);
});
test('deployment verifier fails closed for protected preview, missing page, bad storage and wrong revision', async () => {
  const origin = 'https://strikeout.example';
  for (const [override, pattern] of [
    [new Response(null, { status: 307, headers: { location: 'https://vercel.com/login' } }), /deployment protection/],
    [new Response('missing', { status: 404 }), /HTTP 404/],
  ]) await assert.rejects(checkDeployment(origin, { fetcher: fetcher({ '/devfest.html': override }) }), pattern);
  await assert.rejects(checkDeployment(origin, { expectedSha: 'wrong', fetcher: fetcher() }), /revision/);
  const unhealthy = new Response(JSON.stringify({ ok: true, storage: 'unconfigured' }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(checkDeployment(origin, { fetcher: fetcher({ '/api/health': unhealthy }) }), /working local-durable-files storage read/);
  const tokenOnly = new Response(JSON.stringify({ ok: true, storage: 'private-durable-blob', storageRead: false }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(checkDeployment(origin, { fetcher: fetcher({ '/api/health': tokenOnly }) }), /working local-durable-files storage read/);
  await assert.rejects(checkDeployment('http://attacker.example', { fetcher: fetcher() }), /HTTPS site origin/);
  await assert.rejects(checkDeployment(), /Pass the site origin/);
});

test('storage readiness checks a real read and fails closed without leaking error details', async () => {
  let reads = 0;
  const readRecord = async () => { reads++; return null; };
  assert.deepEqual(await inspectStorage({ cloud: true, token: '', readRecord }),
    { ok: false, storage: 'unconfigured', storageRead: false });
  assert.equal(reads, 0);
  assert.deepEqual(await inspectStorage({ cloud: true, token: 'fictional', readRecord }),
    { ok: true, storage: 'private-durable-blob', storageRead: true });
  assert.equal(reads, 1);
  const failed = await inspectStorage({ cloud: true, token: 'fictional',
    readRecord: async () => { throw Object.assign(new Error('secret must stay private'), { code: 'PRIVATE' }); } });
  assert.deepEqual(failed, { ok: false, storage: 'unavailable', storageRead: false,
    storageErrorType: 'Error', storageFailure: 'other_storage_error' });
  assert.ok(!JSON.stringify(failed).includes('secret'));
  for (const [message, category] of [
    ['Invalid token: unable to extract store ID', 'invalid_token_format'],
    ['Vercel Blob: Invalid token: unable to extract store ID', 'invalid_token_format'],
    ['Failed to fetch blob: 403 Forbidden', 'blob_http_403'],
    ['Vercel Blob: Failed to fetch blob: 403 Forbidden', 'blob_http_403'],
    ['Failed to fetch blob: 500 Server Error', 'blob_http_500'],
  ]) {
    const result = await inspectStorage({ cloud: true, token: 'fictional',
      readRecord: async () => { throw Error(message + ' PRIVATE_TOKEN'); } });
    assert.equal(result.storageFailure, category);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_TOKEN'));
  }
});
