// Optional live integration check. Uses one real provider request with fictional text.
import app from '../api/index.mjs';
import {remove, hash} from '../api/store.mjs';

const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let cookie;
let account;
let code;
let token;
async function post(route, body = {}, headers = {}) {
  const response = await fetch(base + route, {method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body)});
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const result = await response.json();
  if (!response.ok) throw Error(route + ': ' + response.status + ' ' + result.error);
  return result;
}
try {
  if (!process.env.GEMINI_API_KEY) throw Error('Set GEMINI_API_KEY on the server before the live check.');
  account = (await post('/api/demo/start')).user;
  code = (await post('/api/pop/connect-code', {}, {cookie})).code;
  token = (await post('/api/pop/pair', {code})).token;
  const answer = await post('/api/pop/chat', {message: 'Explain in one short sentence what your local page identifier check does. Do not claim to scan the internet.', history: []}, {authorization: 'Bearer ' + token});
  console.log('Live Pop AI request passed. Reply:', answer.text);
} finally {
  if (token) await remove('pop-sessions/' + hash(token));
  if (code) await remove('pop-pair/' + hash(code));
  if (account) { await remove('users/' + account.id); await remove('workspaces/' + account.workspaceId); }
  if (cookie) await remove('sessions/' + hash(cookie.split('=')[1]));
  await new Promise(resolve => server.close(resolve));
}
