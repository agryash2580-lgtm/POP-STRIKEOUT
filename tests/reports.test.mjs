import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {reportsRouter} from '../api/reports.mjs';
import {createGemini, researchTopic, caseSnapshot, validateReport, officialURL} from '../api/report-ai.mjs';
import {newCase} from '../api/reporting-core.mjs';
import {createMailer} from '../api/report-mail.mjs';
import {read, write, remove} from '../api/store.mjs';
import {createReportsClient} from '../shared/reports-client.js';
import mainApp from '../api/index.mjs';
import {hash} from '../api/store.mjs';

const research = {sources: [{id: 'S1', title: 'Google account recovery', url: 'https://support.google.com/accounts/answer/6294825', excerpts: ['Use official recovery.'], retrievedAt: '2026-10-31T09:00:00.000Z'}], searchEntryPoint: '', searchedAt: '2026-10-31T09:00:00.000Z'};
const report = {summary: 'The user reports losing access to a fictional Google account.', observations: [], unknowns: ['No independent confirmation of compromise.'], nextSteps: [{id: 'recover', title: 'Use official recovery', detail: 'Use official recovery.', sourceIds: ['S1'], serviceId: 'expert'}, {id: 'evidence', title: 'Organise evidence', detail: 'Use official recovery.', sourceIds: ['S1'], serviceId: 'reporting'}], complaintDraft: 'USER-REPORTED DRAFT, NOT SUBMITTED\nI report losing access to a fictional account. Please advise on recovery. The incident date is unknown.'};
const details = {title: 'Fictional account access incident', category: 'account_takeover', platform: 'Google', description: 'I cannot access my fictional account. This is a test, not a real incident.', email: 'private@example.com', phone: '+12025550123'};

test('research uses only a category and allowlisted platform; report selection and references are checked', () => {
  const value = newCase(details);
  const topic = researchTopic({...value, platform: 'Search for private@example.com at attacker.invalid'});
  assert.ok(!topic.includes('private@example.com')); assert.ok(!topic.includes('attacker.invalid'));
  assert.equal(officialURL('https://support.google.com.attacker.invalid/'), false);
  assert.equal(officialURL('http://support.google.com/'), false);
  assert.throws(() => caseSnapshot(value, {aiApproved: false, evidenceIds: [], includeFiles: false}));
  assert.throws(() => caseSnapshot(value, {aiApproved: true, evidenceIds: ['other-case'], includeFiles: false}));
  const snapshot = caseSnapshot(value, {aiApproved: true, evidenceIds: [], includeFiles: false});
  assert.ok(!JSON.stringify(snapshot).includes('private@example.com'));
  assert.throws(() => validateReport({...report, nextSteps: [{...report.nextSteps[0], sourceIds: ['fabricated']}]}, snapshot, research));
  assert.throws(() => validateReport({...report, observations: [{text: 'Invented evidence', evidenceIds: ['fake']}]}, snapshot, research));
  assert.throws(() => validateReport({...report, summary: 'It happened on 2025-01-01.'}, snapshot, research), /unsupplied date/);
  const validated = validateReport(report, snapshot, research);
  assert.equal(validated.summary, 'User-reported account (not independently verified): ' + details.description);
  assert.equal(validated.nextSteps[0].detail, 'Use official recovery.');
  assert.match(validated.complaintDraft, /NOT SUBMITTED/);
});

test('real session middleware protects reports and one request saves a case plus its resumable job', async () => {
  const server = mainApp.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie, owner, caseId, reportId;
  async function request(path, method = 'GET', body, origin) {
    const response = await fetch(base + path, {method, headers: {'content-type': 'application/json', ...(cookie ? {cookie} : {}), ...(origin ? {origin} : {})}, body: body ? JSON.stringify(body) : undefined});
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return {status: response.status, value: await response.json()};
  }
  try {
    assert.equal((await request('/api/reports/capabilities')).status, 401);
    owner = (await request('/api/demo/start', 'POST', {})).value.user;
    const options = {details, dataVersion: 0, aiApproved: true, includeFiles: false, evidenceIds: [], emailReport: false};
    assert.equal((await request('/api/reports/cases', 'POST', options, 'https://attacker.invalid')).status, 403);
    const saved = await request('/api/reports/cases', 'POST', options);
    assert.equal(saved.status, 201); assert.equal(saved.value.dataVersion, 1);
    caseId = saved.value.case.id; reportId = saved.value.report.id;
    assert.equal(saved.value.report.stage, 'research');
    assert.equal((await request('/api/reporting/cases/' + caseId)).value.case.title, details.title);
    assert.equal((await request('/api/reports/jobs/' + reportId)).value.stage, 'research');
    await request('/api/reporting/cases/' + caseId, 'DELETE', {dataVersion: 1, confirm: true});
    assert.equal(await read('analysis_jobs/' + owner.id + '/' + reportId), null);
    assert.equal((await request('/api/reports/jobs/' + reportId)).status, 404);
  } finally {
    if (owner) {
      await remove('analysis_cases/' + owner.id + '/' + caseId);
      if (reportId) await remove('analysis_jobs/' + owner.id + '/' + reportId);
      await remove('users/' + owner.id); await remove('workspaces/' + owner.workspaceId);
    }
    if (cookie) await remove('sessions/' + hash(cookie.split('=')[1]));
    await new Promise(resolve => server.close(resolve));
  }
});

test('Gemini adapter sends search tools, resolves grounding redirects, rejects empty grounding, and validates JSON', async () => {
  const requests = [];
  const ai = createGemini({env: {GEMINI_API_KEY: 'test-only'}, fetcher: async (url, options) => {
    if (url.startsWith('https://vertexaisearch.cloud.google.com/')) return new Response(null, {status: 302, headers: {location: research.sources[0].url}});
    const body = JSON.parse(options.body); requests.push(body);
    if (body.tools) return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: 'Use official recovery.'}]}, groundingMetadata: {groundingChunks: [{web: {uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test', title: 'Google help'}}], groundingSupports: [{groundingChunkIndices: [0], segment: {text: 'Use official recovery.'}}]}}]});
    return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(report)}]}}]});
  }});
  const bundle = await ai.research(details);
  assert.equal(bundle.sources[0].url, research.sources[0].url);
  const snapshot = caseSnapshot(newCase(details), {aiApproved: true, evidenceIds: [], includeFiles: false});
  assert.equal((await ai.write(snapshot, bundle)).nextSteps.length, 2);
  assert.deepEqual(requests[0].tools, [{google_search: {}}]);
  assert.ok(!JSON.stringify(requests[0]).includes(details.description));
  assert.equal(requests[1].generationConfig.responseMimeType, 'application/json');
  const empty = createGemini({env: {GEMINI_API_KEY: 'test-only'}, fetcher: async () => Response.json({candidates: [{content: {parts: [{text: 'Uncited text'}]}}]})});
  await assert.rejects(() => empty.research(details), /usable official sources/);
  const bad = createGemini({env: {GEMINI_API_KEY: 'test-only'}, fetcher: async () => Response.json({candidates: [{finishReason: 'MAX_TOKENS', content: {parts: [{text: '{}'}]}}]})});
  await assert.rejects(() => bad.write(snapshot, research), /complete answer/);
});

test('mail adapter attaches the exact PDF and uses an idempotency key; missing configuration fails honestly', async () => {
  let payload, headers;
  const mail = createMailer({env: {RESEND_API_KEY: 'test-only', REPORT_EMAIL_FROM: 'verified@example.com'}, fetcher: async (url, options) => { payload = JSON.parse(options.body); headers = options.headers; return Response.json({id: 'test-mail'}); }});
  assert.equal((await mail.send({to: 'recipient@example.com', subject: 'Report', text: 'Review', key: 'report/test', attachment: 'dGVzdA=='})).status, 'accepted');
  assert.equal(headers['Idempotency-Key'], 'report/test'); assert.equal(payload.attachments[0].content, 'dGVzdA==');
  await assert.rejects(() => createMailer({env: {}}).send({}), /not configured/);
});

test('saved report stages survive restart, isolate users, generate real PDF, retry failures, remember progress and deduplicate email', async () => {
  const account = {id: randomUUID(), cases: [newCase(details)], dataVersion: 0};
  const caseId = account.cases[0].id;
  const keys = [], sent = [], calls = {research: 0, write: 0, help: 0};
  let failResearch = true, failMail = true, lastProgress, server, base, jobId;
  const ai = {
    async research() { calls.research++; if (failResearch) { failResearch = false; throw Object.assign(Error('Research temporarily unavailable'), {status: 503}); } return research; },
    async write() { calls.write++; await new Promise(r => setTimeout(r, 35)); return structuredClone(report); },
    async help(job, mode, message, progress) { calls.help++; lastProgress = progress; return {answer: mode === 'summary' ? 'A simpler explanation of your saved report.' : 'Recovery is recorded as done. Organise the remaining evidence.', sourceIds: ['S1'], serviceIds: ['reporting']}; }
  };
  const mail = {configured: () => true, async send(message) { sent.push(message); if (message.attachment && failMail) { failMail = false; throw Object.assign(Error('Acceptance unknown'), {status: 503}); } return {status: 'accepted', providerId: 'test-accepted'}; }};
  async function startServer() {
    const app = express(); app.use(express.json());
    const guarded = fn => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { res.status(e.status || 500).json({error: e.message}); } };
    app.use('/api/reports', reportsRouter({user: async req => { if (req.headers['x-test-user'] === 'other') return {id: 'other-' + account.id, cases: []}; return account; }, guarded, limited() {}, ai, mail}));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  }
  async function request(path, method = 'GET', body, other = false) {
    const response = await fetch(base + '/api/reports' + path, {method, headers: {'content-type': 'application/json', ...(other ? {'x-test-user': 'other'} : {})}, body: body ? JSON.stringify(body) : undefined});
    return {status: response.status, value: (response.headers.get('content-type') || '').includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())};
  }
  await startServer();
  try {
    assert.equal((await request('/cases/' + caseId, 'POST', {aiApproved: false})).status, 400);
    assert.equal((await request('/email/verification', 'POST', {email: 'recipient@example.com'})).status, 200);
    const code = sent[0].text.match(/\b\d{6}\b/)[0];
    assert.equal((await request('/email/confirm', 'POST', {code: '000000'})).status, 400);
    assert.equal((await request('/email/confirm', 'POST', {code})).status, 200);
    const selection = {aiApproved: true, evidenceIds: [], includeFiles: false, emailReport: true};
    const begun = await request('/cases/' + caseId, 'POST', selection);
    assert.equal(begun.status, 201); jobId = begun.value.id;
    assert.equal((await request('/cases/' + caseId, 'POST', selection)).value.id, jobId);
    assert.equal((await request('/jobs/' + jobId, 'GET', null, true)).status, 404);
    assert.equal((await request('/jobs/' + jobId + '/advance', 'POST', {})).status, 503);
    assert.match((await request('/jobs/' + jobId)).value.error, /temporarily/);
    assert.equal((await request('/jobs/' + jobId + '/advance', 'POST', {})).value.stage, 'writing');
    const parallel = await Promise.all([request('/jobs/' + jobId + '/advance', 'POST', {}), request('/jobs/' + jobId + '/advance', 'POST', {})]);
    assert.ok(parallel.some(r => r.status === 409 || r.status === 202)); assert.equal(calls.write, 1);
    await new Promise(resolve => server.close(resolve)); await startServer();
    assert.equal((await request('/jobs/' + jobId)).value.stage, 'pdf');
    assert.equal((await request('/jobs/' + jobId + '/advance', 'POST', {})).value.stage, 'email');
    const pdf = await request('/jobs/' + jobId + '/pdf'); assert.equal(pdf.value.subarray(0, 5).toString(), '%PDF-');
    await mkdir('output/pdf', {recursive: true}); await writeFile('output/pdf/fictional-ai-report.pdf', pdf.value);
    const {PDFDocument} = await import('pdf-lib'); assert.ok((await PDFDocument.load(pdf.value)).getPageCount() >= 1);
    assert.equal((await request('/jobs/' + jobId + '/advance', 'POST', {})).status, 503);
    assert.equal((await request('/jobs/' + jobId)).value.pdfReady, true);
    const finished = await request('/jobs/' + jobId + '/advance', 'POST', {});
    assert.equal(finished.value.stage, 'ready'); assert.equal(finished.value.email.status, 'accepted');
    const emails = sent.filter(m => m.attachment); assert.equal(emails.length, 2); assert.equal(emails[0].key, emails[1].key); assert.equal(emails[0].attachment, emails[1].attachment); assert.equal(emails[1].attachment, pdf.value.toString('base64'));
    await request('/jobs/' + jobId + '/advance', 'POST', {}); assert.equal(sent.filter(m => m.attachment).length, 2);
    await request('/jobs/' + jobId + '/progress', 'POST', {stepId: 'recover', done: true, note: 'I say I completed recovery.'});
    const answer = await request('/jobs/' + jobId + '/help', 'POST', {mode: 'guidance', message: 'What now?', aiApproved: true});
    assert.equal(answer.status, 200); assert.equal(answer.value.freshResearch, false); assert.equal(lastProgress.completedSteps[0].stepId, 'recover');
    await request('/jobs/' + jobId + '/help', 'POST', {mode: 'summary', aiApproved: true}); assert.equal(calls.research, 2);
    const client = createReportsClient({base: base + '/api/reports'});
    assert.equal((await client.status(jobId)).stage, 'ready');
    account.cases[0].description = 'Changed fictional facts.';
    assert.equal((await request('/jobs/' + jobId)).value.stale, true);
    assert.equal((await request('/jobs/' + jobId + '/help', 'POST', {mode: 'summary', aiApproved: true})).status, 409);
    const next = await request('/cases/' + caseId, 'POST', {...selection, emailReport: false});
    assert.equal(next.value.version, 2); keys.push(next.value.id);
    assert.equal((await request('/cases/' + caseId, 'DELETE', {confirm: true})).status, 200);
    assert.equal((await request('/jobs/' + jobId)).status, 404);
  } finally {
    for (const id of [jobId, ...keys].filter(Boolean)) await remove('analysis_jobs/' + account.id + '/' + id);
    await remove('analysis_cases/' + account.id + '/' + caseId); await remove('analysis_email/' + account.id);
    await new Promise(resolve => server.close(resolve));
  }
});
