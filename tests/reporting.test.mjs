import test from 'node:test';
import assert from 'node:assert/strict';
import {newCase, evidenceItem, generateDraft, draftDigest, draftStatus, exportHTML, dateOnly, webAddress, publicCase} from '../api/reporting-core.mjs';
import {parsePopHandoff} from '../shared/reporting-client.js';

const details = {
  title: 'Fictional impersonation account', category: 'impersonation', platform: 'Instagram',
  description: 'A fictional account is using my name and requesting recovery codes from my contacts.',
  profile: 'https://example.com/fake-profile', contactName: 'Alex Example', email: 'private@example.com', phone: '+1 202 555 0147'
};

test('drafts use only supplied facts, selected evidence and explicitly included contact fields', () => {
  const incident = newCase(details);
  const selected = evidenceItem({note: 'Selected message screenshot', url: 'https://example.com/message?token=secret'});
  const omitted = evidenceItem({note: 'Unselected private note'});
  incident.evidence.push(selected, omitted);
  const draft = generateDraft(incident, {targetId: 'national_portal', evidenceIds: [selected.id], includeContact: false});
  assert.match(draft.text, /Not supplied/);
  assert.match(draft.text, /Selected message screenshot/);
  assert.ok(!draft.text.includes('Unselected private note'));
  assert.ok(!draft.text.includes('private@example.com'));
  assert.ok(!draft.text.includes('+1 202'));
  assert.ok(!draft.text.includes('token=secret'));
  assert.throws(() => generateDraft(incident, {targetId: 'national_portal', evidenceIds: ['foreign-evidence'], includeContact: false}), /does not belong/);
  assert.throws(() => generateDraft(incident, {targetId: 'national_portal', evidenceIds: []}), /whether to include/);
});

test('approval is invalid after facts, legacy summaries, evidence or wording change', () => {
  const incident = newCase(details);
  incident.reporting.draft = generateDraft(incident, {targetId: 'national_portal', evidenceIds: [], includeContact: false});
  assert.equal(draftStatus(incident), 'review_required');
  incident.reporting.draft.approvedDigest = draftDigest(incident.reporting.draft);
  assert.equal(draftStatus(incident), 'approved');
  incident.reporting.draft.text += '\nAn unreviewed addition.';
  assert.equal(draftStatus(incident), 'review_required');
  incident.reporting.draft.approvedDigest = draftDigest(incident.reporting.draft);
  incident.summary = 'Changed through the existing website API';
  assert.equal(draftStatus(incident), 'stale');
  assert.throws(() => exportHTML(incident), /approve the current draft/);
});

test('export escapes untrusted text and supports Unicode without external resources', () => {
  const incident = newCase({...details, description: '<script>alert("test")</script> नमस्ते'});
  incident.reporting.draft = generateDraft(incident, {targetId: 'national_portal', evidenceIds: [], includeContact: false});
  incident.reporting.draft.approvedDigest = draftDigest(incident.reporting.draft);
  const html = exportHTML(incident);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /नमस्ते/);
  assert.ok(!html.includes('<script src='));
});

test('file validation rejects wrong types and oversized files and hashes accepted bytes', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN0sAAAAASUVORK5CYII=';
  const item = evidenceItem({note: 'Fictional one-pixel image', file: {name: '../capture.png', type: 'image/png', data: png}});
  assert.match(item.file.sha256, /^[a-f0-9]{64}$/);
  assert.ok(!item.file.name.includes('/'));
  assert.throws(() => evidenceItem({note: 'test', file: {name: 'payload.bat', type: 'image/png', data: png}}), /correct.*extension/);
  assert.throws(() => evidenceItem({note: 'test', file: {name: 'bad.png', type: 'image/png', data: 'data:image/png;base64,PHNjcmlwdD4='}}), /header/);
  assert.throws(() => evidenceItem({note: 'test', file: {name: 'large.png', type: 'image/png', data: 'data:image/png;base64,' + Buffer.alloc(501 * 1024).toString('base64')}}), /500 KB/);
});

test('dates are real calendar dates and public URL identifiers survive token stripping', () => {
  assert.equal(dateOnly('2024-02-29'), '2024-02-29');
  assert.throws(() => dateOnly('2026-02-30'), /real date/);
  assert.equal(webAddress('https://www.facebook.com/profile.php?id=123&token=secret#session'), 'https://www.facebook.com/profile.php?id=123');
  assert.throws(() => webAddress('javascript:alert(1)'), /HTTP or HTTPS/);
  assert.throws(() => webAddress('https://user:password@example.com'), /without credentials/);
  const incident = newCase(details);
  incident.reporting.followUps = [{id: 'old', dueOn: '2000-01-01', status: 'pending'}, {id: 'done', dueOn: '2000-01-01', status: 'done'}];
  assert.equal(publicCase(incident).reporting.followUps[0].overdue, true);
  assert.equal(publicCase(incident).reporting.followUps[1].overdue, false);
  assert.ok(!('overdue' in incident.reporting.followUps[0]));
});

test('Pop imports prefill reviewed facts only and reject unsafe or oversized handoffs', () => {
  const value = parsePopHandoff('#handoff=' + encodeURIComponent(JSON.stringify({description: 'Saved by Pop', link: 'https://example.com/page?secret=123#token', role: 'admin'})));
  assert.deepEqual(value, {title: 'Evidence from Pop', category: 'other', description: 'Saved by Pop', profile: 'https://example.com/page'});
  assert.equal(parsePopHandoff('#handoff=' + encodeURIComponent(JSON.stringify({description: 'test', link: 'javascript:alert(1)'}))), null);
  assert.equal(parsePopHandoff('#handoff=%bad'), null);
  assert.equal(parsePopHandoff('#handoff=' + 'x'.repeat(40000)), null);
});
