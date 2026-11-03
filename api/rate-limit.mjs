import { isIP } from 'node:net';

// Best-effort in-process guard. Vercel supplies x-vercel-forwarded-for; a
// locally supplied x-forwarded-for never selects a new bucket. A distributed
// limit is still needed.
export function createRateLimiter({ now = Date.now, capacity = 3000, onVercel = !!process.env.VERCEL } = {}) {
  const limits = new Map();
  return function limited(req, scope, max = 30) {
    const vercelIP = onVercel && req.headers?.['x-vercel-forwarded-for'];
    const identity = typeof vercelIP === 'string' && isIP(vercelIP)
      ? vercelIP : req.ip || req.socket?.remoteAddress || 'unknown';
    const key = scope + ':' + identity;
    const time = now();
    let entry = limits.get(key);
    if (!entry || entry.until <= time) {
      if (!entry && limits.size >= capacity) {
        for (const [candidate, value] of limits) {
          if (value.until <= time) limits.delete(candidate);
        }
        if (limits.size >= capacity)
          throw Object.assign(Error('Too many requests. Please wait a minute and try again.'), { status: 429 });
      }
      entry = { count: 0, until: time + 60000 };
      limits.set(key, entry);
    }
    if (++entry.count > max)
      throw Object.assign(Error('Too many requests. Please wait a minute and try again.'), { status: 429 });
  };
}
