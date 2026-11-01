import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';
import {hash, remove} from '../api/store.mjs';
import {createReportingClient} from '../shared/reporting-client.js';

test('complete reporting workflow persists, isolates users, rejects stale approval and never submits externally', async () => {
  let server;
  let base;
  const jars = {};
  const users = [];
  async function start() {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  async function request(who, route, method = 'GET', body, headers = {}) {
    const response = await fetch(base + route, {method, headers: {...(body ? {'content-type': 'application/json'} : {}), ...(jars[who] ? {cookie: jars[who]} : {}), ...headers}, body: body ? JSON.stringify(body) : undefined});
    if (response.headers.get('set-cookie')) jars[who] = response.headers.get('set-cookie').split(';')[0];
    const contentType = response.headers.get('content-type') || '';
    return {status: response.status, value: contentType.includes('application/json') ? await response.json() : await response.text()};
  }
  await start();
  try {
    assert.equal((await request('none', '/api/reporting/cases')).status, 401);
    for (const who of ['a', 'b']) {
      const guest = await request(who, '/api/demo/start', 'POST', {});
      users.push(guest.value.user);
    }
    const channels = await request('none', '/api/reporting/channels');
    assert.equal(channels.value.automaticSubmission, false);
    let version = 0;
    const create = await request('a', '/api/reporting/cases', 'POST', {dataVersion: version, details: {title: 'Fictional case', category: 'impersonation', platform: 'Instagram', description: 'A fictional profile is impersonating me. No real person is involved.', email: 'private@example.com'}});
    assert.equal(create.status, 201);
    const id = create.value.case.id;
    const route = '/api/reporting/cases/' + id;
    version = create.value.dataVersion;
    assert.equal((await request('b', route)).status, 404);
    assert.equal((await request('b', route + '/draft', 'POST', {dataVersion: 0})).status, 404);
    assert.equal((await request('a', route, 'PATCH', {dataVersion: version, details: {title: 'Forbidden'}}, {origin: 'https://unrelated.invalid'})).status, 403);
    assert.equal((await request('a', route + '/export')).status, 409);
    const evidence = await request('a', route + '/evidence', 'POST', {dataVersion: version, evidence: {note: 'A fictional screenshot', file: {name: 'fictional.png', type: 'image/png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN0sAAAAASUVORK5CYII='}}});
    assert.equal(evidence.status, 201);
    version = evidence.value.dataVersion;
    const evidenceId = evidence.value.case.evidence[0].id;
    assert.equal((await request('b', route + '/evidence/' + evidenceId + '/file')).status, 404);
    const originalFile = await fetch(base + route + '/evidence/' + evidenceId + '/file', {headers: {cookie: jars.a}});
    assert.equal(originalFile.status, 200);
    assert.match(originalFile.headers.get('content-type'), /application\/octet-stream/);
    assert.match(originalFile.headers.get('content-disposition'), /attachment.*fictional.png/);
    assert.equal(hash(Buffer.from(await originalFile.arrayBuffer())), evidence.value.case.evidence[0].file.sha256);
    const selected = await request('a', route + '/draft', 'POST', {dataVersion: version, targetId: 'national_portal', includeContact: false, evidenceIds: [evidenceId]});
    assert.equal(selected.status, 200);
    version = selected.value.dataVersion;
    const wording = selected.value.case.reporting.draft.text;
    assert.ok(!wording.includes('private@example.com'));
    assert.equal((await request('a', route + '/draft/approve', 'POST', {dataVersion: version, reviewed: false, text: wording})).status, 400);
    assert.equal((await request('a', route + '/draft/approve', 'POST', {dataVersion: version, reviewed: true, text: wording + 'different'})).status, 409);
    const approved = await request('a', route + '/draft/approve', 'POST', {dataVersion: version, reviewed: true, text: wording});
    assert.equal(approved.status, 200);
    version = approved.value.dataVersion;
    const exported = await request('a', route + '/export?format=html');
    assert.equal(exported.status, 200);
    assert.match(exported.value, /data:image\/png;base64/);
    assert.ok(!exported.value.includes('private@example.com'));
    const follow = await request('a', route + '/follow-ups', 'POST', {dataVersion: version, dueOn: '2000-01-01', note: 'Check the official portal myself.'});
    version = follow.value.dataVersion;
    assert.equal(follow.value.case.reporting.followUps[0].overdue, true);
    const submission = await request('a', route + '/submissions', 'POST', {dataVersion: version, submittedByMe: true, channelId: 'national_portal', reference: 'FICTIONAL-123', submittedOn: '2026-10-31'});
    assert.equal(submission.status, 201);
    version = submission.value.dataVersion;
    assert.equal(submission.value.case.reporting.submissions[0].source, 'user-recorded');
    assert.equal(submission.value.case.reporting.submissions[0].officialStatus, 'not_checked');
    const done = await request('a', route + '/follow-ups/' + follow.value.case.reporting.followUps[0].id, 'PATCH', {dataVersion: version, status: 'done'});
    version = done.value.dataVersion;
    assert.equal(done.value.case.reporting.followUps[0].overdue, false);
    // Restarting the HTTP service does not erase the saved private case.
    await new Promise(resolve => server.close(resolve));
    await start();
    assert.equal((await request('a', route)).value.case.reporting.submissions[0].reference, 'FICTIONAL-123');
    const changed = await request('a', route, 'PATCH', {dataVersion: version, details: {description: 'A corrected fictional account of the incident.'}});
    version = changed.value.dataVersion;
    assert.equal(changed.value.case.reporting.draftStatus, 'stale');
    assert.equal((await request('a', route + '/export')).status, 409);
    assert.equal((await request('a', route, 'PATCH', {dataVersion: 0, details: {title: 'Stale overwrite'}})).status, 409);
    assert.equal((await request('a', route)).value.case.title, 'Fictional case');
    const resolved = await request('a', route + '/resolution', 'POST', {dataVersion: version, resolved: true, note: 'I consider the fictional incident resolved.'});
    version = resolved.value.dataVersion;
    assert.equal(resolved.value.case.reporting.resolution.source, 'user-reported');
    // The frontend adapter can use the same server without React or another framework.
    const client = createReportingClient({base: base + '/api/reporting', fetcher: (url, options) => fetch(url, {...options, headers: {...options.headers, cookie: jars.a}})});
    assert.equal((await client.listCases()).cases.length, 1);
    await client.deleteCase(id);
    assert.equal((await request('a', '/api/reporting/cases')).value.cases.length, 0);
    assert.equal((await request('b', '/api/reporting/cases')).value.cases.length, 0);
  } finally {
    for (const account of users) { await remove('users/' + account.id); await remove('workspaces/' + account.workspaceId); }
    for (const cookie of Object.values(jars)) await remove('sessions/' + hash(cookie.split('=')[1]));
    await new Promise(resolve => server.close(resolve));
  }
});

test('parallel case edits preserve the winning save and reject the outdated write', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie, account;
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, {method, headers: {...(body ? {'content-type': 'application/json'} : {}), ...(cookie ? {cookie} : {})}, body: body ? JSON.stringify(body) : undefined});
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return {status: response.status, value: await response.json()};
  }
  try {
    account = (await request('/api/demo/start', 'POST', {})).value.user;
    const created = await request('/api/reporting/cases', 'POST', {dataVersion: 0, details: {title: 'Concurrent case', category: 'other', description: 'Fictional concurrency test.'}});
    const route = '/api/reporting/cases/' + created.value.case.id;
    const version = created.value.dataVersion;
    const results = await Promise.all([
      request(route, 'PATCH', {dataVersion: version, details: {title: 'First candidate', reporting: {resolution: {resolved: true}}, id: 'forged-id'}}),
      request(route, 'PATCH', {dataVersion: version, details: {title: 'Second candidate'}})
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const winner = results.find(result => result.status === 200).value;
    const saved = (await request(route)).value;
    assert.equal(saved.case.title, winner.case.title);
    assert.equal(saved.dataVersion, version + 1);
    assert.equal(saved.case.id, created.value.case.id);
    assert.equal(saved.case.reporting.resolution, null);
  } finally {
    if (account) { await remove('users/' + account.id); await remove('workspaces/' + account.workspaceId); }
    if (cookie) await remove('sessions/' + hash(cookie.split('=')[1]));
    await new Promise(resolve => server.close(resolve));
  }
});
