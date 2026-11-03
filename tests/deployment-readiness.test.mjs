import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDeployment } from '../scripts/check-deployment.mjs';

const files = {
  '/api/health': [JSON.stringify({ ok: true, version: '2.3.0', revision: 'abc123def456', storage: 'private-durable-blob' }), 'application/json'],
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
});
test('deployment verifier fails closed for protected preview, missing page, bad storage and wrong revision', async () => {
  const origin = 'https://strikeout.example';
  for (const [override, pattern] of [
    [new Response(null, { status: 307, headers: { location: 'https://vercel.com/login' } }), /deployment protection/],
    [new Response('missing', { status: 404 }), /HTTP 404/],
  ]) await assert.rejects(checkDeployment(origin, { fetcher: fetcher({ '/devfest.html': override }) }), pattern);
  await assert.rejects(checkDeployment(origin, { expectedSha: 'wrong', fetcher: fetcher() }), /revision/);
  const unhealthy = new Response(JSON.stringify({ ok: true, storage: 'unconfigured' }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(checkDeployment(origin, { fetcher: fetcher({ '/api/health': unhealthy }) }), /durable private storage/);
  await assert.rejects(checkDeployment('http://attacker.example', { fetcher: fetcher() }), /HTTPS site origin/);
});
