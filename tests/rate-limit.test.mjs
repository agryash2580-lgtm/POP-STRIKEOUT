import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../api/rate-limit.mjs';

test('forwarded header cannot evade the local limiter', () => {
  const limited = createRateLimiter({ onVercel: false });
  const request = { ip: '198.51.100.10', headers: { 'x-forwarded-for': '203.0.113.1' } };
  limited(request, 'auth', 2);
  request.headers['x-forwarded-for'] = '203.0.113.2';
  limited(request, 'auth', 2);
  request.headers['x-forwarded-for'] = '203.0.113.3';
  assert.throws(() => limited(request, 'auth', 2), error => error.status === 429);
});

test('Vercel-issued client IP separates visitors and ignores a spoofed ordinary forwarding header', () => {
  const limited = createRateLimiter({ onVercel: true });
  const request = { ip: 'proxy', headers: { 'x-vercel-forwarded-for': '198.51.100.10', 'x-forwarded-for': '203.0.113.1' } };
  limited(request, 'auth', 1);
  request.headers['x-forwarded-for'] = '203.0.113.2';
  assert.throws(() => limited(request, 'auth', 1), error => error.status === 429);
  request.headers['x-vercel-forwarded-for'] = '198.51.100.11';
  limited(request, 'auth', 1);
});

test('local limiter resets after a minute and bounds active identities', () => {
  let time = 0;
  const limited = createRateLimiter({ now: () => time, capacity: 2 });
  limited({ ip: 'first' }, 'search', 1);
  limited({ ip: 'second' }, 'search', 1);
  assert.throws(() => limited({ ip: 'third' }, 'search', 1), error => error.status === 429);
  time = 60000;
  limited({ ip: 'third' }, 'search', 1);
  limited({ ip: 'first' }, 'search', 1);
});
