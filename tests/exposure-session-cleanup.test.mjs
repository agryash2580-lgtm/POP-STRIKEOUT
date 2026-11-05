import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import app from '../api/index.mjs';
import { hash, read, write, remove } from '../api/store.mjs';

test('signing out removes the session-bound exposure grant', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const credentials = {
    username: 'grant_logout_' + randomBytes(6).toString('hex'),
    password: 'Fictional-logout-test-42',
  };
  let account, cookie, grantKey, sessionKey;
  async function request(path, method = 'GET', body) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith('strikeout_session='));
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  }
  try {
    const registered = await request('/api/auth/register', 'POST', credentials);
    assert.equal(registered.status, 200);
    account = (await registered.json()).user;
    const token = cookie.split('=')[1];
    grantKey = 'osint_authenticator/' + hash(account.id + ':' + token);
    sessionKey = 'sessions/' + hash(token);
    await write(grantKey, { version: 0, expires: Date.now() + 1800000 });
    assert.ok(await read(grantKey));
    assert.equal((await request('/api/auth/logout', 'POST', {})).status, 200);
    assert.equal(await read(grantKey), null);
    assert.equal(await read(sessionKey), null);
    assert.equal((await request('/api/osint/auth/status')).status, 401);
  } finally {
    if (grantKey) await remove(grantKey);
    if (sessionKey) await remove(sessionKey);
    if (account) {
      await remove('users/' + account.id);
      await remove('workspaces/' + account.workspaceId);
    }
    await new Promise(resolve => server.close(resolve));
  }
});
