import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
const dir = path.resolve(".data");
const writes = new Map();
const conflict = () =>
  Object.assign(
    Error(
      "The saved version changed. Your draft is still available; reload the saved version and merge your changes.",
    ),
    { status: 409, code: "STORAGE_CONFLICT" },
  );
export const usesCloud = () =>
  !!process.env.VERCEL || process.env.STORAGE_BACKEND === "blob";
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export async function read(key) {
  if (!/^[a-z0-9/_-]+$/i.test(key)) throw Error("Invalid storage key");
  // Compressed JSON receives a weak W/ ETag, which cannot be used for If-Match.
  // Request the original representation so larger records retain a strong tag.
  if (usesCloud() && process.env.BLOB_READ_WRITE_TOKEN) {
    const { get, BlobNotFoundError } = await import("@vercel/blob");
    let r;
    try {
      r = await get("strikeout/" + key + ".json", {
        access: "private",
        useCache: false,
        headers: { "accept-encoding": "identity" },
      });
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
    if (!r) return null;
    const value = JSON.parse(await new Response(r.stream).text());
    Object.defineProperty(value, "_etag", {
      value: r.blob.etag,
      enumerable: false,
    });
    return value;
  }
  if (process.env.VERCEL) throw Error("Persistent storage is not configured");
  try {
    const raw = await readFile(
        path.join(dir, key.replaceAll("/", "_") + ".json"),
        "utf8",
      ),
      value = JSON.parse(raw);
    Object.defineProperty(value, "_etag", {
      value: hash(raw),
      enumerable: false,
    });
    return value;
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export async function write(key, value, etag) {
  if (!/^[a-z0-9/_-]+$/i.test(key)) throw Error("Invalid storage key");
  if (usesCloud() && process.env.BLOB_READ_WRITE_TOKEN) {
    const {
      put,
      BlobPreconditionFailedError,
      BlobServiceRateLimited,
      BlobServiceNotAvailable,
    } = await import("@vercel/blob");
    try {
      await put("strikeout/" + key + ".json", JSON.stringify(value), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        ...(etag || value._etag ? { ifMatch: etag || value._etag } : {}),
      });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw conflict();
      if (
        e instanceof BlobServiceRateLimited ||
        e instanceof BlobServiceNotAvailable
      )
        throw Object.assign(
          Error(
            "Saving is temporarily unavailable. Your pending changes are kept in this tab. Please retry.",
          ),
          {
            status: 503,
            code: "STORAGE_UNAVAILABLE",
            retryable: true,
            retryAfter: e.retryAfter || 1,
          },
        );
      throw e;
    }
    return;
  }
  if (process.env.VERCEL) throw Error("Persistent storage is not configured");
  const previous = writes.get(key) || Promise.resolve();
  const pending = previous
    .catch(() => {})
    .then(async () => {
      const expected = etag || value._etag;
      if (expected && (await read(key))?._etag !== expected) throw conflict();
      await mkdir(dir, { recursive: true });
      const p = path.join(dir, key.replaceAll("/", "_") + ".json"),
        tmp = p + "." + randomUUID();
      await writeFile(tmp, JSON.stringify(value));
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            await rename(tmp, p);
            break;
          } catch (e) {
            if (!["EPERM", "EACCES", "EBUSY"].includes(e.code) || attempt === 4)
              throw e;
            await new Promise((resolve) =>
              setTimeout(resolve, 20 * 2 ** attempt),
            );
          }
        }
      } catch (e) {
        await unlink(tmp).catch(() => {});
        throw e;
      }
    });
  writes.set(key, pending);
  try {
    await pending;
  } finally {
    if (writes.get(key) === pending) writes.delete(key);
  }
}
export async function remove(key) {
  if (usesCloud() && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del("strikeout/" + key + ".json");
  } else {
    try {
      await unlink(path.join(dir, key.replaceAll("/", "_") + ".json"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
