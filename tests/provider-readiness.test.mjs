import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProviderReadiness } from '../scripts/check-provider-readiness.mjs';

function fixture(overrides = {}) {
  const calls = [];
  const integrations = Object.fromEntries(['githubReferences', 'passwordRange', 'webSearch', 'emailBreaches', 'serpSearch', 'reverseImage'].map(name => [name, async (...args) => {
    calls.push({ name, args });
    return name === 'githubReferences' ? { checks: [{ status: 'completed' }] } : { status: 'completed' };
  }]));
  return { calls, integrations: { ...integrations, ...overrides } };
}

test('smoke check does not contact an old deployment or run image lookup without an explicit URL', async () => {
  const f = fixture();
  const report = await checkProviderReadiness({ env: { SERPAPI_API_KEY: 'fixture-secret' }, integrations: f.integrations });
  assert.deepEqual(f.calls.map(c => c.name), ['githubReferences', 'passwordRange', 'serpSearch', 'serpSearch', 'serpSearch']);
  assert.equal(report.checks.find(c => c.provider === 'serpapi_google_lens').status, 'not_tested');
  assert.equal(JSON.stringify(report).includes('fixture-secret'), false);
  assert.equal(JSON.stringify(f.calls).includes('vercel.app'), false);
  for (const call of f.calls.filter(c => c.name === 'serpSearch'))
    assert.equal(call.args[0].q, 'site:example.org "strikeout-demo"');
});

test('an operator-supplied image uses the validated image adapter and incomplete results fail', async () => {
  const f = fixture({ reverseImage: async body => {
    assert.equal(body.imageUrl, 'https://example.org/owned-photo.png');
    assert.deepEqual(body.consent.providers, ['serpapi']);
    return { status: 'incomplete' };
  } });
  const report = await checkProviderReadiness({ env: { SERPAPI_API_KEY: 'fixture', STRIKEOUT_SMOKE_IMAGE_URL: 'https://example.org/owned-photo.png' }, integrations: f.integrations });
  assert.equal(report.checks.find(c => c.provider === 'serpapi_google_lens').status, 'unavailable');
});

test('smoke reports omit arbitrary upstream error data and distinguish missing keys', async () => {
  const f = fixture({ githubReferences: async () => { throw Object.assign(Error('private-upstream-marker'), { code: 'private-code-marker' }); } });
  const report = await checkProviderReadiness({ env: {}, integrations: f.integrations });
  assert.equal(report.checks.find(c => c.provider === 'github_public').code, 'request_failed');
  assert.equal(report.checks.find(c => c.provider === 'serpapi_google').status, 'not_configured');
  assert.equal(JSON.stringify(report).includes('private-'), false);
});
