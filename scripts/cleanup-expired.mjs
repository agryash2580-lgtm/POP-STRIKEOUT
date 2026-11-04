import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, remove, usesCloud } from '../api/store.mjs';

// Only short-lived authentication artifacts belong in this sweep. In particular,
// verified report email addresses, case data, evidence and mail receipts do not.
export const EXPIRING_PREFIXES = Object.freeze([
  'sessions/', 'mfa_challenges/', 'mfa_enrollment/', 'oauth_states/',
  'pop-pair/', 'pop-sessions/', 'osint_authenticator/', 'osint_domains/',
]);
export const GRACE_MS = 24 * 60 * 60 * 1000;

export function isExpiredRecord(record, now = Date.now(), graceMs = GRACE_MS) {
  return Number.isFinite(record?.expires) && record.expires <= now - graceMs;
}

export async function cleanupExpired({ keys, readRecord, deleteRecord, apply = false,
  now = Date.now(), graceMs = GRACE_MS } = {}) {
  const summary = { scanned: 0, eligible: 0, deleted: 0, changed: 0, errors: 0 };
  for await (const key of keys) {
    if (!EXPIRING_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
    summary.scanned++;
    try {
      const record = await readRecord(key);
      if (!isExpiredRecord(record, now, graceMs)) continue;
      summary.eligible++;
      if (!apply) continue;
      // The second read protects records refreshed between enumeration and removal.
      const current = await readRecord(key);
      if (!isExpiredRecord(current, now, graceMs) || current._etag !== record._etag) {
        summary.changed++;
        continue;
      }
      if (await deleteRecord(key, current._etag)) summary.deleted++;
      else summary.changed++;
    } catch {
      // One corrupt or transiently unavailable record must not stop the sweep.
      // Do not log keys or record content: some key suffixes identify accounts.
      summary.errors++;
    }
  }
  return { ...summary, applied: apply, graceHours: graceMs / 3600000 };
}

async function* localKeys() {
  let files;
  try { files = await readdir(path.resolve('.data')); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const prefix of EXPIRING_PREFIXES) {
    const flat = prefix.replaceAll('/', '_');
    for (const filename of files) {
      if (!filename.startsWith(flat) || !filename.endsWith('.json')) continue;
      const suffix = filename.slice(flat.length, -5);
      if (/^[a-z0-9_-]+$/i.test(suffix)) yield prefix + suffix;
    }
  }
}

async function* cloudKeys(list) {
  for (const prefix of EXPIRING_PREFIXES) {
    let cursor;
    do {
      const result = await list({ prefix: 'strikeout/' + prefix, limit: 500, ...(cursor ? { cursor } : {}) });
      for (const blob of result.blobs) {
        const pathname = blob.pathname;
        if (!pathname.startsWith('strikeout/' + prefix) || !pathname.endsWith('.json')) continue;
        const suffix = pathname.slice(('strikeout/' + prefix).length, -5);
        if (/^[a-z0-9_-]+$/i.test(suffix)) yield prefix + suffix;
      }
      if (result.hasMore && (!result.cursor || result.cursor === cursor))
        throw Error('Blob listing did not advance; cleanup stopped.');
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  }
}

export async function runCleanup({ apply = false } = {}) {
  if (usesCloud()) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw Error('Private Blob storage is not configured.');
    const { list, del, BlobPreconditionFailedError } = await import('@vercel/blob');
    return cleanupExpired({ keys: cloudKeys(list), readRecord: read, apply,
      deleteRecord: async (key, etag) => {
        try { await del('strikeout/' + key + '.json', { ifMatch: etag }); return true; }
        catch (error) {
          if (error instanceof BlobPreconditionFailedError) return false;
          throw error;
        }
      } });
  }
  return cleanupExpired({ keys: localKeys(), readRecord: read, apply,
    deleteRecord: async (key, etag) => {
      if ((await read(key))?._etag !== etag) return false;
      await remove(key);
      return true;
    } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) {
    console.error('Usage: npm run cleanup:expired -- [--apply]');
    process.exitCode = 2;
  } else {
    try {
      const result = await runCleanup({ apply: args.includes('--apply') });
      console.log(JSON.stringify(result));
      if (result.errors) process.exitCode = 1;
    }
    catch (error) { console.error('Cleanup stopped:', error.message); process.exitCode = 1; }
  }
}
