import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import app from '../api/index.mjs';
import { read, write, remove, hash } from '../api/store.mjs';
import { validateReport } from '../api/report-ai.mjs';
import { sendGmail } from '../api/report-smtp.mjs';

test('concurrent registration has exactly one owner and evidence capacity creates no orphan', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (route, body, cookie, method = 'POST') => {
    const response = await fetch(base + route, {method, headers: {'Content-Type':'application/json', ...(cookie ? {cookie} : {})}, body: body ? JSON.stringify(body) : undefined});
    return {status:response.status, body:await response.json(), cookie:response.headers.getSetCookie().find(x=>x.startsWith('strikeout_session='))?.split(';')[0]};
  };
  let cookie, owner;
  const ids = [randomUUID(), randomUUID()];
  try {
    const username = 'race_' + randomUUID().slice(0, 20);
    const registrations = await Promise.all(['first','second'].map(suffix => call('/api/auth/register', {username, password:'Fictional-password-' + suffix})));
    assert.deepEqual(registrations.map(x=>x.status).sort(), [200,409]);
    const winner = registrations.find(x=>x.status===200);
    cookie = winner.cookie; owner = winner.body.user.id;
    await write('pop_evidence_index/' + owner, {ids:Array.from({length:49},(_,i)=>'fictional-' + i)});
    const capture = id => ({id, name:'Fictional capacity test', address:'https://example.org', capturedAt:new Date().toISOString(), imageData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XluW0AAAAASUVORK5CYII='});
    const uploads = await Promise.all(ids.map(id=>call('/api/library', capture(id), cookie)));
    assert.deepEqual(uploads.map(x=>x.status).sort(), [201,413]);
    const index = await read('pop_evidence_index/' + owner);
    for(const id of ids) {
      if(await read('pop_evidence/' + owner + '/' + id)) assert.ok(index.ids.includes(id));
    }
    assert.equal((await call('/api/account', undefined, cookie, 'DELETE')).status,200);
    for(const id of ids) assert.equal(await read('pop_evidence/' + owner + '/' + id),null);
    cookie = undefined;
  } finally {
    if(cookie) await call('/api/account', undefined, cookie, 'DELETE');
    if(owner) for(const id of ids) await remove('pop_evidence/' + owner + '/' + id);
    await new Promise(resolve => server.close(resolve));
  }
});

test('report accepts dated source excerpts and the full allowed evidence note', () => {
  const note = 'a'.repeat(2200);
  const passage = 'Use the official form updated 2026-01-01.';
  const snapshot = {details:{description:'Fictional incident.'}, evidence:[{id:'E1',note}]};
  const research = {sources:[{id:'S1',excerpts:[passage]}]};
  const output = {summary:'Fictional incident.', complaintDraft:'Fictional draft.', unknowns:[], observations:[{text:note,evidenceIds:['E1']}], nextSteps:[{id:'step1',serviceId:'reporting',detail:passage,sourceIds:['S1']}]};
  const report = validateReport(output,snapshot,research);
  assert.equal(report.observations[0].text,note);
  assert.equal(report.nextSteps[0].detail,passage);
  assert.throws(()=>validateReport({...output,summary:'Invented date 2030-01-01'},snapshot,research), /unsupplied date/);
});

test('definite SMTP rejection permits retry while accepted receipt prevents duplicates', async () => {
  const original = nodemailer.createTransport;
  const key = 'regression-' + randomUUID();
  const env = {SMTP_USER:'fictional@example.org',SMTP_APP_PASSWORD:'abcdefghijklmnop'};
  let calls = 0;
  nodemailer.createTransport = () => ({close(){},async sendMail(){calls++;if(calls===1)throw Object.assign(Error('Fictional authentication failure'),{code:'EAUTH'});return {accepted:['fictional@example.org'],messageId:'fictional'};}});
  const options = {env,to:'fictional@example.org',subject:'Fictional',text:'No real delivery',key};
  try {
    await assert.rejects(sendGmail(options), /not accepted/);
    assert.equal((await sendGmail(options)).status,'accepted');
    assert.equal((await sendGmail(options)).status,'accepted');
    assert.equal(calls,2);
  } finally {
    nodemailer.createTransport = original;
    await remove('mail_receipts/' + hash('gmail:' + env.SMTP_USER + ':' + key));
  }
});

test('uncertain SMTP acceptance remains blocked rather than risking duplicate delivery', async () => {
  const original = nodemailer.createTransport;
  const key = 'uncertain-' + randomUUID();
  const env = {SMTP_USER:'fictional@example.org',SMTP_APP_PASSWORD:'abcdefghijklmnop'};
  let calls = 0;
  nodemailer.createTransport = () => ({close(){},async sendMail(){calls++;throw Object.assign(Error('Fictional timeout'),{code:'ETIMEDOUT'});}});
  const options = {env,to:'fictional@example.org',subject:'Fictional',text:'No real delivery',key};
  try {
    await assert.rejects(sendGmail(options), error=>error.status===503);
    await assert.rejects(sendGmail(options), error=>error.status===409);
    assert.equal(calls,1);
  } finally {
    nodemailer.createTransport = original;
    await remove('mail_receipts/' + hash('gmail:' + env.SMTP_USER + ':' + key));
  }
});

