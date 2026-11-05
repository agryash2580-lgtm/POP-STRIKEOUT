import { read, usesCloud } from './store.mjs';

const probeKey = 'health/storage_read_probe_7d924ce41b';

function failureCategory(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message.startsWith('Invalid token: unable to extract store ID'))
    return 'invalid_token_format';
  if (message.startsWith('No blob credentials found'))
    return 'missing_blob_credentials';
  const upstream = /^Failed to fetch blob: ([45]\d\d)\b/.exec(message);
  if (upstream) return 'blob_http_' + upstream[1];
  return 'other_storage_error';
}

// A configured token is not evidence that private Blob reads actually work.
// Request a deliberately absent key so the storage service must authenticate
// and answer the read without exposing or changing any account record.
export async function inspectStorage({
  cloud = usesCloud(),
  token = process.env.BLOB_READ_WRITE_TOKEN,
  readRecord = read,
} = {}) {
  if (cloud && !token)
    return { ok: false, storage: 'unconfigured', storageRead: false };
  try {
    await readRecord(probeKey);
    return {
      ok: true,
      storage: cloud ? 'private-durable-blob' : 'local-durable-files',
      storageRead: true,
    };
  } catch (error) {
    const name = error?.constructor?.name;
    return {
      ok: false,
      storage: 'unavailable',
      storageRead: false,
      // Fixed categories only: never include upstream messages, credentials or paths.
      storageErrorType: typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)
        ? name : 'Error',
      storageFailure: failureCategory(error),
    };
  }
}
