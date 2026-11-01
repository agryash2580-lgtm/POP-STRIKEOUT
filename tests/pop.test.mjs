import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({URL});
vm.runInContext(await readFile(new URL('../extension/shared.js', import.meta.url), 'utf8'), context);
const Pop = context.Pop;
const watchlist = [
  {id: 'email', kind: 'email', value: 'alex@example.com'},
  {id: 'phone', kind: 'phone', value: '+1 202 555 0147'},
  {id: 'username', kind: 'username', value: '@alex_demo'}
];

test('identifier checks match formatted numbers and exact identifiers, with sentence punctuation', () => {
  assert.equal(Pop.findMatches('Email ALEX@example.com. Phone +1 (202) 555-0147. @alex_demo!', watchlist).length, 3);
  assert.equal(Pop.findMatches('joalex@example.com alex@example.com.evil 9120255501478 not_alex_demo', watchlist).length, 0);
  assert.equal(Pop.findMatches('alex@example.com', [{id: 'bad', kind: 'email', value: '.*'}]).length, 0);
});

test('removal preserves unrelated text and handles overlapping identifiers once', () => {
  const input = 'Keep this. alex@example.com then @alex_demo.';
  const matches = Pop.findMatches(input, [...watchlist, {...watchlist[0], id: 'duplicate'}]);
  assert.equal(matches.length, 2);
  assert.equal(Pop.removeMatches(input, matches), 'Keep this.  then .');
});

test('addresses omit credentials, queries and fragments and reject non-web schemes', () => {
  assert.equal(Pop.cleanAddress('https://user:secret@example.com/path?token=secret#private'), 'https://example.com/path');
  assert.equal(Pop.cleanAddress('javascript:alert(1)'), '');
  assert.equal(Pop.cleanAddress('not a URL'), '');
});

test('link inspection never equates an ordinary-looking HTTPS link with safety', () => {
  assert.match(Pop.analyzeLink('', 'https://example.com').join(' '), /does not establish safety/);
  assert.match(Pop.analyzeLink('instagram.com', 'https://instagram.com.attacker.invalid').join(' '), /These differ/);
  assert.match(Pop.analyzeLink('', 'https://instagram.com@attacker.invalid').join(' '), /hostname is attacker.invalid/);
});

test('browser manifests share tools but use their own background implementations', async () => {
  const chrome = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url)));
  const firefox = JSON.parse(await readFile(new URL('../extension/manifest.firefox.json', import.meta.url)));
  assert.equal(chrome.background.service_worker, 'background.js');
  assert.equal(firefox.background.scripts.at(-1), 'background.js');
  assert.deepEqual(chrome.permissions, firefox.permissions.filter(p=>!["webRequest","webRequestBlocking"].includes(p)));
  assert.ok(firefox.permissions.includes("webRequestBlocking"));
  assert.ok(!chrome.permissions.includes('history'));
  for (const file of ['shared.js', 'pet.js', 'page-scan.js', 'sharing-guard.js', 'evidence.js', 'workspace.js']) {
    new vm.Script(await readFile(new URL('../extension/' + file, import.meta.url), 'utf8'));
  }
});
