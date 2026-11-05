import test from 'node:test';
import assert from 'node:assert/strict';
import { secureCookies } from '../api/secure-cookie.mjs';

test('self-hosted production and legacy cloud use HTTPS-only cookies', () => {
  assert.equal(secureCookies({ NODE_ENV: 'production' }), true);
  assert.equal(secureCookies({ VERCEL: '1' }), true);
  assert.equal(secureCookies({ NODE_ENV: 'development' }), false);
});
