import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import * as storage from '../store.mjs';
import { securityState } from '../mfa.mjs';
import { publicDomain } from './dorks.mjs';

const CHALLENGE_MS = 30 * 60 * 1000;
const PROOF_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DOMAINS = 5;
const fail = (status, message) => { throw Object.assign(Error(message), { status }); };
const keyFor = id => 'osint_domains/' + id;
const txtName = domain => '_strikeout-verify.' + domain;
const txtValue = token => 'strikeout-verification=' + token;
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function domainOwnershipService({
  store = storage, now = Date.now, security = securityState,
  resolve = resolveTxt, random = () => randomBytes(24).toString('hex'),
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
      pending: pending ? { name: txtName(domain), value: txtValue(pending.token), expires: pending.expires } : null };
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

  async function verify(req, input) {
    const domain = publicDomain(input);
    const state = await current(req, domain);
    if (state.verified) return state;
    if (!state.pending) fail(409, 'Start a domain verification and publish its DNS TXT record first.');
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
    const account = await security(req.osintUser.id);
    if (!account.enabled) fail(403, 'Enable your authenticator before verifying a domain.');
    await update(req, domain, entry => {
      if (entry.pending?.expires <= now() || !same(txtValue(entry.pending?.token), state.pending.value))
        fail(409, 'The challenge changed or expired. Start verification again.');
      return { verified: { version: account.version, at: now(), expires: now() + PROOF_MS } };
    });
    return current(req, domain);
  }

  async function requireOwned(req, input) {
    const state = await current(req, input);
    if (!state.verified)
      fail(403, 'Verify control of this exact domain with a DNS TXT record before searching it.');
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
