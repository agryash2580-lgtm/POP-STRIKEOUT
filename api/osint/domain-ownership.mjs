import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import * as storage from '../store.mjs';
import { securityState } from '../mfa.mjs';
import { publicDomain } from './dorks.mjs';
import { resolvePublic } from './image-url.mjs';

const CHALLENGE_MS = 30 * 60 * 1000;
const PROOF_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DOMAINS = 5;
const fail = (status, message) => { throw Object.assign(Error(message), { status }); };
const keyFor = id => 'osint_domains/' + id;
const txtName = domain => '_strikeout-verify.' + domain;
const txtValue = token => 'strikeout-verification=' + token;
const proofPath = '/.well-known/strikeout-verify.txt';
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

// DNS is checked before this call. Pin the selected public IP for the actual
// TLS request so a second DNS answer cannot redirect the fetch to a private
// address. The original hostname remains the TLS identity and HTTP Host.
export function readProofFile(domain, { address, family }, { request = httpsRequest } = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, body) => {
      if (finished) return;
      finished = true;
      if (error) reject(error); else resolve(body);
    };
    const req = request({
      hostname: domain, servername: domain, port: 443, method: 'GET',
      path: proofPath, agent: false, maxHeaderSize: 8192,
      signal: AbortSignal.timeout(5000),
      lookup: (_hostname, options, callback) => options?.all
        ? callback(null, [{ address, family }]) : callback(null, address, family),
      headers: { Accept: 'text/plain', 'Accept-Encoding': 'identity',
        'User-Agent': 'StrikeOut-domain-proof/1.0' },
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        finish(null, null);
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 256) { req.destroy(); finish(null, null); }
        else chunks.push(chunk);
      });
      response.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
      response.on('error', error => finish(error));
    });
    req.on('error', error => finish(error));
    req.setTimeout(5000, () => req.destroy(Error('HTTPS proof timeout')));
    req.end();
  });
}

export function domainOwnershipService({
  store = storage, now = Date.now, security = securityState,
  resolve = resolveTxt, random = () => randomBytes(24).toString('hex'),
  resolveAddress = resolvePublic, readFile = readProofFile,
} = {}) {
  async function current(req, input) {
    const domain = publicDomain(input);
    const [account, record] = await Promise.all([
      security(req.osintUser.id), store.read(keyFor(req.osintUser.id)),
    ]);
    const entry = record?.domains?.[domain] || {};
    const verified = !!(entry.verified?.expires > now() &&
      entry.verified.version === account.version && account.enabled);
    const pending = entry.pending?.expires > now() ? entry.pending : null;
    return { domain, verified, verifiedUntil: verified ? entry.verified.expires : null,
      pending: pending ? { name: txtName(domain), value: txtValue(pending.token),
        https: { url: `https://${domain}${proofPath}`, value: txtValue(pending.token) },
        expires: pending.expires } : null };
  }

  async function update(req, domain, change) {
    const key = keyFor(req.osintUser.id);
    await store.createIfMissing(key, { domains: {}, expires: 0 });
    const record = await store.read(key);
    const fresh = Object.fromEntries(Object.entries(record.domains || {}).filter(([, entry]) =>
      entry.pending?.expires > now() || entry.verified?.expires > now()));
    if (!fresh[domain] && Object.keys(fresh).length >= MAX_DOMAINS)
      fail(429, 'At most five active domain verifications can be kept at once. Revoke an old domain first.');
    fresh[domain] = await change(fresh[domain] || {});
    const expires = Math.max(0, ...Object.values(fresh).flatMap(entry =>
      [entry.pending?.expires || 0, entry.verified?.expires || 0]));
    await store.write(key, { domains: fresh, expires }, record._etag);
  }

  async function challenge(req, input) {
    const domain = publicDomain(input);
    const existing = await current(req, domain);
    if (existing.verified || existing.pending) return existing;
    const token = random();
    if (!/^[a-f0-9]{48}$/.test(token)) throw Error('Invalid challenge generator');
    await update(req, domain, entry => ({ ...entry,
      pending: { token, expires: now() + CHALLENGE_MS } }));
    return current(req, domain);
  }

  async function verify(req, input, method = 'dns') {
    if (!['dns', 'https'].includes(method)) fail(400, 'Choose DNS TXT or HTTPS file verification.');
    const domain = publicDomain(input);
    const state = await current(req, domain);
    if (state.verified) return state;
    if (!state.pending) fail(409, 'Start a domain challenge and publish its DNS TXT record or HTTPS proof file first.');
    if (method === 'dns') {
      let rows, timer;
      try {
        rows = await Promise.race([
          resolve(txtName(domain)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(Error('DNS timeout')), 5000); }),
        ]);
      } catch (error) {
        if (['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(error.code))
          fail(409, 'The DNS TXT record is not visible yet. Check the record name and try again after propagation.');
        fail(502, 'DNS verification is temporarily unavailable. Try again shortly.');
      } finally { clearTimeout(timer); }
      if (!Array.isArray(rows) || !rows.some(parts => Array.isArray(parts) &&
        same(parts.join(''), state.pending.value)))
        fail(409, 'The DNS TXT record does not match this verification challenge.');
    } else {
      let body;
      try {
        const resolved = await resolveAddress(state.pending.https.url);
        body = await readFile(domain, resolved);
      } catch (error) {
        if (error.status === 400) fail(409, 'The proof host must resolve only to public internet addresses.');
        fail(502, 'HTTPS verification is temporarily unavailable. Try again shortly.');
      }
      if (!same(body?.trim(), state.pending.value))
        fail(409, 'The HTTPS proof file must return the exact challenge text without a redirect.');
    }
    const account = await security(req.osintUser.id);
    if (!account.enabled) fail(403, 'Enable your authenticator before verifying a domain.');
    await update(req, domain, entry => {
      if (entry.pending?.expires <= now() || !same(txtValue(entry.pending?.token), state.pending.value))
        fail(409, 'The challenge changed or expired. Start verification again.');
      return { verified: { version: account.version, method, at: now(), expires: now() + PROOF_MS } };
    });
    return current(req, domain);
  }

  async function requireOwned(req, input) {
    const state = await current(req, input);
    if (!state.verified)
      fail(403, 'Verify control of this exact domain with DNS TXT or an HTTPS proof file before searching it.');
    return state;
  }

  async function revoke(req, input) {
    const domain = publicDomain(input);
    const key = keyFor(req.osintUser.id);
    const record = await store.read(key);
    if (!record?.domains?.[domain]) return { domain, verified: false, verifiedUntil: null, pending: null };
    const domains = { ...record.domains };
    delete domains[domain];
    const expires = Math.max(0, ...Object.values(domains).flatMap(entry =>
      [entry.pending?.expires || 0, entry.verified?.expires || 0]));
    await store.write(key, { domains, expires }, record._etag);
    return { domain, verified: false, verifiedUntil: null, pending: null };
  }

  return { current, challenge, verify, requireOwned, revoke };
}
