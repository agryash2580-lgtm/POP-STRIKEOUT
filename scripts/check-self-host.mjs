import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import * as OTPAuth from 'otpauth';

const execute = promisify(execFile);
const marker = '# Disposable StrikeOut GitHub CI fixture only\n';
const compose = (...args) => execute('docker', ['compose', ...args], { timeout: 120000 });

// This test recreates containers and its workflow deletes volumes afterwards.
// Refuse to operate on a developer's configuration or a public deployment.
function requireIsolatedCI() {
  if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.STRIKEOUT_SELF_HOST_SMOKE !== '1' ||
      !/^strikeout-ci-\d+-\d+$/.test(process.env.COMPOSE_PROJECT_NAME || ''))
    throw Error('Self-host smoke checks require the isolated GitHub CI fixture.');
}

async function prepare() {
  requireIsolatedCI();
  const created = [];
  try {
    for (const [filename, content] of [
      ['.env', marker + 'STRIKEOUT_DOMAIN=localhost\n'],
      ['.env.production', marker + 'MFA_ENCRYPTION_KEY=' + randomBytes(32).toString('base64') + '\n'],
    ]) {
      await writeFile(filename, content, { flag: 'wx', mode: 0o600 });
      created.push(filename);
    }
  } catch {
    for (const filename of created) await rm(filename, { force: true });
    throw Error('Fixture files could not be created without overwriting existing configuration.');
  }
  console.log('Disposable localhost configuration created; no external provider keys used.');
}

async function eventually(action, description, timeout = 90000) {
  const end = Date.now() + timeout;
  do {
    try { return await action(); } catch {}
    await delay(500);
  } while (Date.now() < end);
  throw Error(description + ' did not become ready before the deadline.');
}

async function verify() {
  requireIsolatedCI();
  for (const filename of ['.env', '.env.production']) {
    if (!(await readFile(filename, 'utf8')).startsWith(marker))
      throw Error('Refusing to operate on non-fixture configuration.');
  }
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'strikeout-ci-ca-'));
  const checks = [];
  const check = (name, value) => { assert.ok(value, name); checks.push(name); };
  let accountCreated = false;
  const cookies = new Map();
  let ca;

  function request(route, { method = 'GET', body, plainHttp = false, origin } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const transport = plainHttp ? http : https;
      const req = transport.request({
        hostname: 'localhost', family: 4, port: plainHttp ? 80 : 443,
        method, path: route, ...(plainHttp ? {} : { ca, rejectUnauthorized: true }),
        headers: {
          ...(!plainHttp && cookies.size ? { Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; ') } : {}),
          ...(payload === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Origin: origin || 'https://localhost' }),
        },
      }, res => {
        const chunks = [];
        let size = 0;
        res.on('data', chunk => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) req.destroy(Error('Unexpected response size.'));
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          for (const header of res.headers['set-cookie'] || []) {
            const pair = header.split(';')[0], split = pair.indexOf('=');
            const name = pair.slice(0, split), value = pair.slice(split + 1);
            if (!value || /Max-Age=0\b/i.test(header)) cookies.delete(name);
            else cookies.set(name, value);
          }
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(Error('Local HTTPS request timed out.')));
      req.end(payload);
    });
  }
  const healthy = () => eventually(async () => {
    const response = await request('/api/health');
    assert.equal(response.status, 200); assert.equal(response.json?.storageRead, true);
    return response;
  }, 'Local HTTPS health');
  const secureCookie = (response, name, sameSite) =>
    (response.headers['set-cookie'] || []).some(header => header.startsWith(name + '=') &&
      /; Secure\b/i.test(header) && /; HttpOnly\b/i.test(header) && header.includes('SameSite=' + sameSite));

  try {
    // Trust only this disposable Caddy instance's public root certificate. Do not
    // install a CA globally or disable TLS verification. See Caddy's Docker docs.
    const certificate = path.join(scratch, 'root.crt');
    await eventually(async () => {
      await compose('cp', 'caddy:/data/caddy/pki/authorities/local/root.crt', certificate);
      ca = await readFile(certificate); assert.ok(ca.includes('BEGIN CERTIFICATE'));
    }, 'Disposable Caddy certificate');
    const health = await healthy();
    check('HTTPS proxy reaches durable local storage', health.json.storage === 'local-durable-files');
    check('running container reports the expected Git revision',
      health.json.revision === process.env.GIT_COMMIT_SHA?.slice(0, 12));
    const redirect = await request('/', { plainHttp: true });
    check('HTTP redirects to HTTPS', [301, 302, 307, 308].includes(redirect.status) && redirect.headers.location === 'https://localhost/');
    check('built React application is served', /id=["']root["']/.test((await request('/')).text));
    check('fictional demonstration is served', (await request('/devfest.html')).text.includes('SYNTHETIC DEMO'));
    check('anonymous workspace access is rejected', (await request('/api/data')).status === 401);
    const before = (await compose('ps', '-q', 'app')).stdout.trim();
    const mount = JSON.parse((await execute('docker', ['inspect', '--format', '{{json .Mounts}}', before])).stdout);
    check('private records use a named Docker volume', mount.some(item => item.Type === 'volume' && item.Destination === '/app/.data'));
    check('application process runs without root', (await compose('exec', '-T', 'app', 'id', '-u')).stdout.trim() !== '0');
    await compose('exec', '-T', 'app', 'node', '-e',
      "const fs=require('node:fs');process.exit(['.env','.env.local','.env.production'].some(p=>fs.existsSync(p))?1:0)");
    check('private environment files are excluded from the image', true);
    let refusedMissingKey = false;
    try { await compose('run', '--rm', '--no-deps', '-e', 'MFA_ENCRYPTION_KEY=', 'app'); }
    catch (error) {
      refusedMissingKey = error.code === 1 && error.stderr?.includes('Production requires a stable 32-byte MFA_ENCRYPTION_KEY');
    }
    check('production startup refuses a missing MFA encryption key', refusedMissingKey);
    const username = 'container_' + randomBytes(6).toString('hex');
    const password = 'Fictional-' + randomBytes(16).toString('hex');
    const registered = await request('/api/auth/register', { method: 'POST', body: { username, password } });
    check('account registration works through HTTPS', registered.status === 200);
    accountCreated = true;
    check('session cookie is HTTPS-only and HttpOnly', secureCookie(registered, 'strikeout_session', 'Strict'));
    const record = { id: 'container-fixture', summary: 'SYNTHETIC container persistence fixture' };
    check('private case saves through the proxy', (await request('/api/data', { method: 'PUT', body: {
      cases: [record], identifiers: [], dataVersion: 0,
    } })).status === 200);
    check('cross-origin writes are rejected', (await request('/api/data', { method: 'PUT', origin: 'https://unrelated.invalid', body: {
      cases: [], identifiers: [], dataVersion: 1,
    } })).status === 403);
    const setup = await request('/api/auth/mfa/setup', { method: 'POST', body: {} });
    assert.equal(setup.status, 200, 'MFA setup response');
    const otp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.json.secret), algorithm: 'SHA1', digits: 6, period: 30 });
    const enabled = await request('/api/auth/mfa/enable', { method: 'POST', body: { code: otp.generate() } });
    check('authenticator enrollment works in the container', enabled.status === 200 && enabled.json.enabled === true);
    const recovery = enabled.json.recoveryCodes[0];
    const review = { documents: [{ text: 'Fictional fixture@example.invalid password=FictionalContainerSecret123' }],
      identifiers: { emails: ['fixture@example.invalid'] }, consent: { selfOwned: true, version: '1', providers: [] } };
    check('exposure requires fresh authenticator verification', (await request('/api/osint/review-documents', { method: 'POST', body: review })).status === 403);

    await compose('up', '--detach', '--force-recreate', '--no-deps', '--wait', '--wait-timeout', '90', 'app');
    check('application container was actually replaced', (await compose('ps', '-q', 'app')).stdout.trim() !== before);
    await healthy();
    const saved = await request('/api/data');
    check('session and private case survive container replacement', saved.status === 200 && saved.json?.cases?.[0]?.summary === record.summary);
    check('MFA configuration survives container replacement', (await request('/api/auth/mfa/status')).json?.enabled === true);
    check('persisted encrypted authenticator verifies after replacement', (await request('/api/osint/auth/verify', {
      method: 'POST', body: { code: otp.generate({ timestamp: Date.now() + 30000 }) },
    })).json?.verified === true);
    const assessed = await request('/api/osint/review-documents', { method: 'POST', body: review });
    check('authorized document assessment works after replacement', assessed.status === 200 && assessed.json?.findings?.length === 2);
    check('assessment response masks the synthetic secret', !assessed.text.includes('FictionalContainerSecret123'));
    const cleanup = await compose('exec', '-T', 'app', 'node', 'scripts/cleanup-expired.mjs');
    check('retention preview is available in the runtime image', JSON.parse(cleanup.stdout).applied === false);
    await request('/api/auth/logout', { method: 'POST', body: {} });
    const login = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    check('MFA login challenge is HTTPS-only and HttpOnly', login.json?.mfaRequired === true && secureCookie(login, 'strikeout_mfa', 'Lax'));
    check('persisted recovery code completes MFA sign-in', (await request('/api/auth/mfa/verify', { method: 'POST', body: { code: recovery } })).status === 200);
    check('recovery code is consumed once', (await request('/api/auth/mfa/status')).json?.recoveryRemaining === 7);

    // Simulate loss of this disposable project's private data volume. The source
    // is stopped before backup, and restoration uses a newly created empty volume.
    const dataVolume = mount.find(item => item.Type === 'volume' && item.Destination === '/app/.data').Name;
    check('recovery test volume belongs only to this isolated fixture', dataVolume.startsWith(process.env.COMPOSE_PROJECT_NAME + '_'));
    const recoveryEnv = { ...process.env, STRIKEOUT_BACKUP_KEY: randomBytes(32).toString('base64') };
    await compose('stop', 'app');
    const archived = await execute('docker', ['compose', 'run', '--rm', '--no-deps', '-T', '-e', 'STRIKEOUT_BACKUP_KEY', 'app',
      'node', 'scripts/storage-backup.mjs', 'create', '--offline'], { env: recoveryEnv, encoding: 'buffer', timeout: 120000, maxBuffer: 128 * 1024 * 1024 });
    check('offline encrypted backup is created', archived.stdout.subarray(0, 20).toString().startsWith('STRIKEOUT-BACKUP-V1'));
    await compose('rm', '--force', 'app');
    await execute('docker', ['volume', 'rm', dataVolume]);
    const restoring = execute('docker', ['compose', 'run', '--rm', '--no-deps', '-T', '-e', 'STRIKEOUT_BACKUP_KEY', 'app',
      'node', 'scripts/storage-backup.mjs', 'restore', '--offline'], { env: recoveryEnv, timeout: 120000 });
    restoring.child.stdin.end(archived.stdout);
    const restored = JSON.parse((await restoring).stdout);
    check('backup restores into newly empty storage', restored.restored > 0 && restored.sessionsRestored === false);
    await compose('up', '--detach', '--no-deps', '--wait', '--wait-timeout', '90', 'app');
    await healthy();
    check('restore does not revive an old session', (await request('/api/data')).status === 401);
    const recoveryLogin = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    check('restored account still requires its authenticator', recoveryLogin.json?.mfaRequired === true);
    const waitMs = Date.parse(restored.mfaCodesUsableAfter) - Date.now() + 200;
    assert.ok(Number.isFinite(waitMs) && waitMs < 90000, 'bounded fresh authenticator wait');
    if (waitMs > 0) await delay(waitMs);
    check('fresh authenticator decrypts after volume-loss recovery', (await request('/api/auth/mfa/verify', {
      method: 'POST', body: { code: otp.generate() },
    })).status === 200);
    check('private case is recovered after volume loss', (await request('/api/data')).json?.cases?.[0]?.summary === record.summary);
    check('restore invalidates historical recovery codes', (await request('/api/auth/mfa/status')).json?.recoveryRemaining === 0);
    check('restore requires a new exposure grant', (await request('/api/osint/review-documents', { method: 'POST', body: review })).status === 403);
    check('restored account can authorize a new assessment', (await request('/api/osint/auth/verify', {
      method: 'POST', body: { code: otp.generate({ timestamp: Date.now() + 30000 }) },
    })).json?.verified === true);
    check('assessment works after backup recovery', (await request('/api/osint/review-documents', { method: 'POST', body: review })).status === 200);
    check('synthetic account can be deleted', (await request('/api/account', { method: 'DELETE' })).status === 200);
    accountCreated = false;
    check('deleted session cannot access private cases', (await request('/api/data')).status === 401);
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    if (accountCreated) await request('/api/account', { method: 'DELETE' }).catch(() => {});
    await rm(scratch, { recursive: true, force: true });
  }
}

try {
  if (process.argv[2] === 'prepare') await prepare();
  else if (process.argv[2] === 'verify') await verify();
  else throw Error('Usage: node scripts/check-self-host.mjs prepare|verify (isolated GitHub CI only).');
} catch (error) {
  // Never dump subprocess arguments or HTTP bodies containing fixture credentials.
  console.error(error?.code && error.code !== 'ERR_ASSERTION'
    ? 'Self-host smoke subprocess failed: ' + error.code : error.message);
  process.exitCode = 1;
}
