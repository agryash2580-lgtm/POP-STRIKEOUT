import { read, usesCloud } from './store.mjs';

const probeKey = 'health/storage_read_probe_7d924ce41b';

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
      // Names only: never include upstream messages, credentials or paths.
      storageErrorType: typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)
        ? name : 'Error',
    };
  }
}
