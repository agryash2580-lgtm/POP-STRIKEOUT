// Explicit live smoke check. Reserved identifiers only; never prints result bodies or keys.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { githubReferences, passwordRange, webSearch, emailBreaches } from '../api/osint/providers.mjs';
import { serpSearch } from '../api/osint/search-provider.mjs';
import { reverseImage } from '../api/osint/images.mjs';
import { createMailer } from '../api/report-mail.mjs';

const adapters = { githubReferences, passwordRange, webSearch, emailBreaches, serpSearch, reverseImage };
export async function checkProviderReadiness({ env = process.env, integrations = adapters } = {}) {
  const checks = [];
  async function check(provider, configured, operation) {
    if (!configured) { checks.push({ provider, status: 'not_configured' }); return; }
    try {
      await operation();
      checks.push({ provider, status: 'request_completed', scope: 'One reserved-example smoke request; not a comprehensive integration test.' });
    } catch (error) {
      const known = ['not_configured', 'rate_limited', 'timeout', 'provider_error', 'network_error'];
      const code = known.includes(error.code) ? error.code :
        (Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? 'http_' + error.status : 'request_failed');
      checks.push({ provider, status: 'unavailable', code });
    }
  }
  await check('github_public', true, async () => {
    const result = await integrations.githubReferences([{ value: 'strikeout-demo@example.org', category: 'public_email_reference' }]);
    if (!result.checks.length || result.checks.some(item => item.status !== 'completed')) throw Error('Incomplete');
  });
  await check('pwned_passwords', true, () => integrations.passwordRange('5BAA6'));
  for (const engine of ['google', 'bing', 'duckduckgo'])
    await check('serpapi_' + engine, !!env.SERPAPI_API_KEY, async () => {
      const result = await integrations.serpSearch({ engine, q: 'site:example.org "strikeout-demo"' }, { env });
      if (!Array.isArray(result.organic_results)) throw Error('No supported organic results section');
    });
  if (env.SERPAPI_API_KEY && !env.STRIKEOUT_SMOKE_IMAGE_URL) {
    checks.push({ provider: 'serpapi_google_lens', status: 'not_tested', reason: 'Set STRIKEOUT_SMOKE_IMAGE_URL only to a public image you own and approve sharing with SerpApi/Google.' });
  } else {
    await check('serpapi_google_lens', !!env.SERPAPI_API_KEY, async () => {
      const result = await integrations.reverseImage({ imageUrl: env.STRIKEOUT_SMOKE_IMAGE_URL, mode: 'api',
        consent: { selfOwned: true, version: '1', providers: ['serpapi'] } }, { env });
      if (result.status !== 'completed') throw Error('Incomplete image check');
    });
  }
  await check('brave', !!env.BRAVE_SEARCH_API_KEY, () => integrations.webSearch('site:example.org "strikeout-demo"', { env }));
  await check('hibp', !!env.HIBP_API_KEY, () => integrations.emailBreaches('strikeout-demo@example.org', { env }));
  for (const [provider, configured] of [
    ['gemini', !!env.GEMINI_API_KEY],
    ['google_sign_in', !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET],
    ['private_blob', !!env.BLOB_READ_WRITE_TOKEN],
    ['email', createMailer({ env }).configured()],
  ]) checks.push({ provider, status: configured ? 'configured_not_tested' : 'not_configured' });
  return { environment: 'local_operator_configuration', checkedAt: new Date().toISOString(), checks,
    limitations: ['No email was sent, no production account was changed, and no provider result contents were printed.',
      'Local configuration does not establish production configuration. Missing results do not establish absence of exposure.',
      'Image lookup requires an explicit operator-owned image URL; no previous deployment is contacted by default.'] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile('.env.local'); } catch {}
  const result = await checkProviderReadiness();
  console.log(JSON.stringify(result, null, 2));
  if (result.checks.some(item => item.status === 'unavailable')) process.exitCode = 1;
}
