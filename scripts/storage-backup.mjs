import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, link, lstat, mkdir, mkdtemp, open, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPIRING_PREFIXES } from './cleanup-expired.mjs';

const MAGIC = Buffer.from('STRIKEOUT-BACKUP-V1\n');
export const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 50000;
const filenamePattern = /^[a-z0-9_-]+\.json$/i;
const transient = name => EXPIRING_PREFIXES.some(prefix => name.startsWith(prefix.replaceAll('/', '_')));
const fail = message => { throw Object.assign(Error(message), { code: 'BACKUP_VALIDATION' }); };

function decodeKey(value) {
  if (typeof value !== 'string') fail('Provide a private 32-byte base64 key.');
  const key = Buffer.from(value.trim(), 'base64');
  if (key.length !== 32 || key.toString('base64') !== value.trim())
    fail('Provide a private 32-byte base64 key.');
  return key;
}
function keys(backupKey, mfaKey) {
  const key = decodeKey(backupKey), mfa = decodeKey(mfaKey);
  if (timingSafeEqual(key, mfa)) fail('Use a separate backup key, not the MFA encryption key.');
  return { key, fingerprint: createHash('sha256').update(mfa).digest('hex') };
}
function recordJSON(text) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch { fail('A storage record is invalid. No record contents were logged.'); }
}
async function safeDirectory(directory, create = false) {
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('Storage must be a real directory.');
}

// Stop the application before taking a snapshot: separate JSON records do not
// provide a transactional live backup. Metadata checks also catch accidental writes.
export async function createBackup({ dataDir = '.data', backupKey, mfaKey } = {}) {
  const { key, fingerprint } = keys(backupKey, mfaKey);
  await safeDirectory(dataDir);
  const entries = await readdir(dataDir, { withFileTypes: true });
  if (entries.length > MAX_FILES) fail('Storage exceeds the supported backup file limit.');
  const files = [], observed = [];
  let bytes = 0;
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !filenamePattern.test(entry.name))
      fail('Storage contains an unsupported entry. Keep the app stopped and inspect it privately.');
    if (transient(entry.name)) continue;
    const filename = path.join(dataDir, entry.name);
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    let contents, stat;
    try {
      stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) fail('A record exceeds the supported backup limit.');
      contents = (await boundedRead(handle.createReadStream({ autoClose: false }), MAX_RECORD_BYTES)).toString('utf8');
      bytes += Buffer.byteLength(contents);
      if (bytes > MAX_BACKUP_BYTES / 2) fail('Storage exceeds the supported backup size.');
    } finally { await handle.close(); }
    const value = recordJSON(contents);
    if (entry.name.startsWith('analysis_email_') && !value.verifiedAt) continue;
    files.push({ name: entry.name, contents });
    observed.push({ filename, stat });
  }
  for (const { filename, stat } of observed) {
    const after = await lstat(filename);
    if (!after.isFile() || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs)
      fail('Storage changed during backup. Stop the app before retrying.');
  }
  if ((await readdir(dataDir)).length !== entries.length)
    fail('Storage changed during backup. Stop the app before retrying.');
  const plain = Buffer.from(JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), mfaKeyFingerprint: fingerprint, files }));
  if (plain.length > MAX_BACKUP_BYTES - MAGIC.length - 28) fail('Backup exceeds the supported size.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export async function restoreBackup({ archive, dataDir = '.data', backupKey, mfaKey, now = Date.now() } = {}) {
  const { key, fingerprint } = keys(backupKey, mfaKey);
  if (!Number.isFinite(now) || !Buffer.isBuffer(archive) || archive.length > MAX_BACKUP_BYTES ||
      archive.length <= MAGIC.length + 28 || !archive.subarray(0, MAGIC.length).equals(MAGIC))
    fail('Unsupported or oversized backup file.');
  let payload;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, archive.subarray(MAGIC.length, MAGIC.length + 12));
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(archive.subarray(MAGIC.length + 12, MAGIC.length + 28));
    const plain = Buffer.concat([decipher.update(archive.subarray(MAGIC.length + 28)), decipher.final()]);
    payload = JSON.parse(plain.toString('utf8'));
  } catch { fail('Backup could not be authenticated. Check the key and file.'); }
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.files) || payload.files.length > MAX_FILES)
    fail('Unsupported backup structure.');
  if (payload.mfaKeyFingerprint !== fingerprint)
    fail('The MFA encryption key does not match this backup. Restore the original private configuration first.');
  const names = new Set(), files = [];
  let usableAfter = now;
  for (const entry of payload.files) {
    if (!entry || typeof entry.name !== 'string' || !filenamePattern.test(entry.name) ||
        names.has(entry.name.toLowerCase()) || transient(entry.name) || typeof entry.contents !== 'string' ||
        Buffer.byteLength(entry.contents) > MAX_RECORD_BYTES)
      fail('Backup contains an invalid or duplicate record.');
    names.add(entry.name.toLowerCase());
    const record = recordJSON(entry.contents);
    if (entry.name.startsWith('analysis_email_') && !record.verifiedAt)
      fail('Pending email verification cannot be restored.');
    if (entry.name.startsWith('account_security_')) {
      if (!Number.isSafeInteger(record.version) || record.version < 0 || record.version >= Number.MAX_SAFE_INTEGER)
        fail('Backup contains invalid account security state.');
      record.version++;
      record.recoveryHashes = [];
      // Do not revive a code used after the snapshot. Expire the entire current
      // TOTP acceptance window; a subsequent fresh authenticator code still works.
      record.lastStep = Math.max(record.lastStep || 0, Math.floor(now / 30000) + 1);
      if (!Number.isSafeInteger(record.lastStep)) fail('Backup contains invalid authenticator state.');
      if (record.enabled) usableAfter = Math.max(usableAfter, (record.lastStep + 1) * 30000);
    }
    files.push({ name: entry.name, contents: JSON.stringify(record) });
  }
  if (!Number.isFinite(usableAfter) || !Number.isFinite(new Date(usableAfter).getTime()))
    fail('Backup contains invalid authenticator state.');
  await safeDirectory(dataDir, true);
  if ((await readdir(dataDir)).length) fail('Restore requires empty storage. Existing records were not overwritten.');
  await chmod(dataDir, 0o700);
  const stage = await mkdtemp(path.join(dataDir, '.restore-'));
  const published = [];
  try {
    for (const file of files) await writeFile(path.join(stage, file.name), file.contents, { flag: 'wx', mode: 0o600 });
    if ((await readdir(dataDir)).some(name => name !== path.basename(stage)))
      fail('Storage changed during restore. Keep the app stopped.');
    for (const file of files) {
      // Hard-link publishing fails if another file appeared; it never overwrites.
      await link(path.join(stage, file.name), path.join(dataDir, file.name));
      published.push(file.name);
    }
  } catch {
    for (const name of published) await rm(path.join(dataDir, name), { force: true });
    fail('Restore could not be completed. Keep the app stopped and inspect storage privately.');
  } finally { await rm(stage, { recursive: true, force: true }); }
  return { restored: files.length, sessionsRestored: false, recoveryCodesInvalidated: true,
    mfaCodesUsableAfter: new Date(usableAfter).toISOString() };
}

async function boundedRead(stream, limit = MAX_BACKUP_BYTES) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) fail('Backup exceeds the supported size.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (!['create', 'restore'].includes(action) || args.length !== 1 || args[0] !== '--offline')
      fail('Stop the app first. Usage: storage-backup.mjs create|restore --offline (archive on stdout/stdin).');
    const options = { backupKey: process.env.STRIKEOUT_BACKUP_KEY, mfaKey: process.env.MFA_ENCRYPTION_KEY };
    if (process.env.VERCEL || process.env.STORAGE_BACKEND === 'blob') fail('This backup tool supports local-file storage only.');
    if (action === 'create') {
      const archive = await createBackup(options);
      process.stdout.write(archive);
    } else {
      const summary = await restoreBackup({ ...options, archive: await boundedRead(process.stdin) });
      console.log(JSON.stringify(summary));
    }
  } catch (error) {
    console.error(error.code === 'BACKUP_VALIDATION' ? error.message : 'Storage recovery failed. Keep the app stopped and inspect storage privately.');
    process.exitCode = 1;
  }
}
