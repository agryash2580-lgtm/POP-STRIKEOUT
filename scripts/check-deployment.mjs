import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultOrigin = 'https://strikeout-mu20.vercel.app';

export async function checkDeployment(origin = defaultOrigin, {
  expectedSha = '', fetcher = fetch, timeoutMs = 12000,
} = {}) {
  const base = new URL(origin);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))))
    throw Error('Use an HTTPS site origin, or local HTTP on localhost. Do not include credentials or paths.');
  const checks = [
    ['/api/health', 'application/json'],
    ['/devfest.html', 'text/html'],
    ['/devfest.css', 'text/css'],
    ['/devfest-demo.js', 'javascript'],
    ['/devfest-fixtures.js', 'javascript'],
  ];
  const responses = new Map();
  for (const [route, type] of checks) {
    let response;
    try {
      response = await fetcher(new URL(route, base), {
        redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw Error(route + ': network error or deadline exceeded. Deployment not verified.');
    }
    if (response.status >= 300 && response.status < 400)
      throw Error(route + ': redirect or deployment protection (HTTP ' + response.status + '). Visitor access not verified.');
    if (!response.ok) throw Error(route + ': HTTP ' + response.status + '. Deployment not verified.');
    if (!(response.headers.get('content-type') || '').toLowerCase().includes(type))
      throw Error(route + ': unexpected content type. Deployment not verified.');
    responses.set(route, response);
  }
  const health = await responses.get('/api/health').json().catch(() => null);
  if (health?.ok !== true || health.storage !== 'private-durable-blob' || health.storageRead !== true)
    throw Error('API health did not confirm a working private storage read.');
  if (expectedSha && (!health.revision || !expectedSha.startsWith(health.revision)))
    throw Error('API revision does not match the expected release commit.');
  const html = await responses.get('/devfest.html').text();
  if (!html.includes('SYNTHETIC DEMO') || !html.includes('/devfest-demo.js'))
    throw Error('DevFest page lacks the fictional-demo marker or its script.');
  return {
    origin: base.origin, revision: health.revision || null, storage: health.storage,
    storageRead: health.storageRead,
    publicAssets: checks.length - 1, visitorAccessible: true,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkDeployment(process.argv[2] || process.env.DEPLOY_URL || defaultOrigin,
      { expectedSha: process.env.EXPECTED_SHA || '' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
