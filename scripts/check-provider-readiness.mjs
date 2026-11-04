// Explicit live smoke check. Reserved identifiers only; never prints result bodies or keys.
import { githubReferences, passwordRange, webSearch, emailBreaches } from '../api/osint/providers.mjs';
import { serpSearch } from '../api/osint/search-provider.mjs';
try { process.loadEnvFile('.env.local'); } catch {}
const checks = [];
async function check(provider, configured, operation) {
  if (!configured) { checks.push({ provider, status: 'not_configured' }); return; }
  try {
    await operation();
    checks.push({ provider, status: 'request_completed', scope: 'One reserved-example smoke request; not a comprehensive integration test.' });
  } catch (error) {
    checks.push({ provider, status: 'unavailable', code: error.code || (error.status ? 'http_' + error.status : 'request_failed') });
  }
}
await check('github_public', true, async () => {
  const result = await githubReferences([{ value: 'strikeout-demo@example.org', category: 'public_email_reference' }]);
  if (result.checks.some(item => item.status !== 'completed')) throw Error('Incomplete');
});
await check('pwned_passwords', true, () => passwordRange('5BAA6'));
for (const engine of ['google', 'bing', 'duckduckgo']) {
  await check('serpapi_' + engine, !!process.env.SERPAPI_API_KEY, () => serpSearch({ engine, q: 'site:example.org "strikeout-demo"' }));
}
await check('serpapi_google_lens', !!process.env.SERPAPI_API_KEY, async () => {
  const data = await serpSearch({ engine: 'google_lens', type: 'all',
    url: 'https://strikeout-mu20.vercel.app/pop.png' });
  if (![data.exact_matches, data.visual_matches, data.organic_results].some(Array.isArray))
    throw Error('No supported Lens result sections');
});
await check('brave', !!process.env.BRAVE_SEARCH_API_KEY, () => webSearch('site:example.org "strikeout-demo"'));
await check('hibp', !!process.env.HIBP_API_KEY, () => emailBreaches('strikeout-demo@example.org'));
for (const [provider, configured] of [
  ['gemini', !!process.env.GEMINI_API_KEY],
  ['google_sign_in', !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET],
  ['private_blob', !!process.env.BLOB_READ_WRITE_TOKEN],
  ['email', !!process.env.RESEND_API_KEY || (!!process.env.SMTP_USER && !!process.env.SMTP_APP_PASSWORD)],
]) checks.push({ provider, status: configured ? 'configured_not_tested' : 'not_configured' });
console.log(JSON.stringify({ environment: 'local_operator_configuration', checkedAt: new Date().toISOString(), checks,
  limitations: ['No email was sent, no production account was changed, and no provider result contents were printed.', 'Local configuration does not establish production configuration. Missing results do not establish absence of exposure.'] }, null, 2));
if (checks.some(item => item.status === 'unavailable')) process.exitCode = 1;
