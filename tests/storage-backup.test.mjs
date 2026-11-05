import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBackup, restoreBackup } from '../scripts/storage-backup.mjs';

const keys = () => ({ backupKey: randomBytes(32).toString('base64'), mfaKey: randomBytes(32).toString('base64') });
async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'strikeout-backup-test-'));
  const source = path.join(directory, 'source'), target = path.join(directory, 'target');
  await mkdir(source);
  try { await run({ directory, source, target, ...keys() }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
const put = (dir, name, value) => writeFile(path.join(dir, name), JSON.stringify(value));
// An authenticated malformed fixture checks the restore boundary independently
// from createBackup's filesystem restrictions.
function seal(payload, backupKey) {
  const magic = Buffer.from('STRIKEOUT-BACKUP-V1\n'), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(backupKey, 'base64'), iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}

test('encrypted recovery preserves private records while invalidating historical authentication', async () => fixture(async ({ source, target, backupKey, mfaKey }) => {
  await put(source, 'users_owner.json', { cases: [{ summary: 'PRIVATE_SYNTHETIC_CASE' }] });
  await put(source, 'account_security_owner.json', { enabled: true, version: 2, secret: 'encrypted-fixture', recoveryHashes: ['old'], lastStep: 1 });
  await put(source, 'analysis_email_owner.json', { email: 'owner@example.invalid', verifiedAt: '2026-01-01' });
  await put(source, 'analysis_email_pending.json', { email: 'pending@example.invalid', codeHash: 'unused', expiresAt: 9999999999999 });
  for (const name of ['sessions_token.json', 'mfa_challenges_token.json', 'osint_authenticator_token.json', 'osint_domains_owner.json', 'pop-sessions_token.json'])
    await put(source, name, { expires: 9999999999999 });
  const options = { dataDir: source, backupKey, mfaKey };
  const archive = await createBackup(options);
  assert.ok(!archive.includes('PRIVATE_SYNTHETIC_CASE'));
  assert.ok(!archive.includes('users_owner'));
  assert.notDeepEqual(await createBackup(options), archive);
  const now = 300000;
  const summary = await restoreBackup({ archive, dataDir: target, backupKey, mfaKey, now });
  assert.equal(summary.restored, 3);
  assert.equal(summary.sessionsRestored, false);
  assert.deepEqual((await readdir(target)).sort(), ['account_security_owner.json', 'analysis_email_owner.json', 'users_owner.json']);
  assert.match(await readFile(path.join(target, 'users_owner.json'), 'utf8'), /PRIVATE_SYNTHETIC_CASE/);
  const security = JSON.parse(await readFile(path.join(target, 'account_security_owner.json')));
  assert.equal(security.version, 3); assert.deepEqual(security.recoveryHashes, []);
  assert.equal(security.secret, 'encrypted-fixture'); assert.equal(security.lastStep, 11);
  assert.equal(summary.mfaCodesUsableAfter, new Date(360000).toISOString());
  assert.equal((await stat(path.join(target, 'users_owner.json'))).mode & 0o777, 0o600);
}));

test('wrong key, altered ciphertext and mismatched MFA key cannot restore any records', async () => fixture(async ({ source, target, backupKey, mfaKey }) => {
  await put(source, 'users_owner.json', { private: 'fixture' });
  const archive = await createBackup({ dataDir: source, backupKey, mfaKey });
  const tampered = Buffer.from(archive); tampered[tampered.length - 1] ^= 1;
  for (const options of [
    { archive, backupKey: keys().backupKey, mfaKey },
    { archive: tampered, backupKey, mfaKey },
    { archive, backupKey, mfaKey: keys().mfaKey },
  ]) await assert.rejects(restoreBackup({ ...options, dataDir: target }));
  await assert.rejects(stat(target), { code: 'ENOENT' });
}));

test('restore refuses existing data and authenticated path traversal, duplicates or transient grants', async () => fixture(async ({ source, target, backupKey, mfaKey }) => {
  await put(source, 'users_owner.json', { private: 'original' });
  const archive = await createBackup({ dataDir: source, backupKey, mfaKey });
  await assert.rejects(restoreBackup({ archive, dataDir: source, backupKey, mfaKey }), /empty storage/);
  assert.equal(JSON.parse(await readFile(path.join(source, 'users_owner.json'))).private, 'original');
  const base = { schemaVersion: 1, mfaKeyFingerprint: createHash('sha256').update(Buffer.from(mfaKey, 'base64')).digest('hex') };
  for (const names of [['../escaped.json'], ['one.json', 'one.json'], ['sessions_revived.json']]) {
    const malicious = seal({ ...base, files: names.map(name => ({ name, contents: '{}' })) }, backupKey);
    await assert.rejects(restoreBackup({ archive: malicious, dataDir: target, backupKey, mfaKey }), /invalid or duplicate record/);
  }
  await assert.rejects(stat(target), { code: 'ENOENT' });
}));

test('backup rejects symlinks, invalid JSON and accidental reuse of the MFA key', async () => fixture(async ({ source, directory, backupKey, mfaKey }) => {
  await writeFile(path.join(directory, 'outside.json'), '{"private":"outside"}');
  await symlink(path.join(directory, 'outside.json'), path.join(source, 'linked.json'));
  await assert.rejects(createBackup({ dataDir: source, backupKey, mfaKey }), /unsupported entry/);
  await rm(path.join(source, 'linked.json'));
  await writeFile(path.join(source, 'broken.json'), 'PRIVATE_INVALID_JSON');
  await assert.rejects(createBackup({ dataDir: source, backupKey, mfaKey }), /record is invalid/);
  await assert.rejects(createBackup({ dataDir: source, backupKey: mfaKey, mfaKey }), /separate backup key/);
}));
