import { createHash } from 'node:crypto';
import * as storage from '../store.mjs';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 12;
const tooMany = seconds => Object.assign(
  Error('Too many exposure requests. Please wait and try again.'),
  { status: 429, retryAfter: seconds },
);

// Each minute has a separate private record. Atomic creation and ETag-checked
// updates make the quota shared by all serverless instances. Only a hash of the
// account ID and scope appears in the storage path.
export function createDistributedLimiter({ store = storage, now = Date.now } = {}) {
  return async function limit(identity, scope, max) {
    if (typeof identity !== 'string' || !identity ||
        typeof scope !== 'string' || !/^[a-z-]+$/.test(scope) ||
        !Number.isSafeInteger(max) || max < 1)
      throw Error('Invalid exposure rate-limit configuration');
    const time = now();
    const window = Math.floor(time / WINDOW_MS);
    const expires = (window + 1) * WINDOW_MS;
    const digest = createHash('sha256').update(scope + ':' + identity).digest('hex');
    const key = `osint_quota/${digest}_${window}`;
    const retryAfter = Math.max(1, Math.ceil((expires - time) / 1000));
    if (await store.createIfMissing(key, { count: 1, expires })) return;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const record = await store.read(key);
      if (!record) continue;
      if (!Number.isSafeInteger(record.count) || record.count < 1 ||
          record.expires !== expires || typeof record._etag !== 'string' || !record._etag)
        throw Object.assign(Error('Exposure quota is unavailable. Please retry shortly.'),
          { status: 503, retryable: true });
      if (record.count >= max) throw tooMany(retryAfter);
      try {
        await store.write(key, { count: record.count + 1, expires }, record._etag);
        return;
      } catch (error) {
        if (error.code !== 'STORAGE_CONFLICT') throw error;
      }
    }
    // Never allow a request through when contention prevents a reliable count.
    throw Object.assign(Error('Exposure quota is busy. Please retry shortly.'),
      { status: 503, retryable: true, retryAfter: 1 });
  };
}
