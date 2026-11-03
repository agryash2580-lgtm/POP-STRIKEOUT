import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scenarios, createDemoReport, exportDemoSummary } from '../frontend/public/devfest-fixtures.js';
import { createDemoServer } from '../scripts/serve-demo.mjs';

test('demo fixtures distinguish evidence, recommendations, unavailable and empty checks', () => {
  assert.equal(scenarios.length, 4);
  for (const scenario of scenarios) {
    const report = createDemoReport(scenario.id);
    assert.equal(report.mode, 'synthetic_demonstration');
    assert.ok(report.limitations.length >= 4);
    for (const source of report.sources) {
      assert.equal(source.simulated, true);
      assert.match(source.location, /^[a-z]+\.example(?:\/|$)/);
    }
    for (const finding of report.findings) {
      assert.equal(finding.synthetic, true);
      assert.ok(finding.recommendation && finding.confidence && finding.severity);
      assert.ok(finding.sourceIds.every(id => report.sources.some(source => source.id === id)));
    }
  }
  assert.equal(createDemoReport('incomplete').status, 'incomplete');
  assert.equal(createDemoReport('empty').status, 'completed');
  assert.equal(createDemoReport('empty').findings.length, 0);
  assert.throws(() => createDemoReport('../../.env.local'));
});

test('demo reports are isolated and exports only contain allowlisted synthetic data', () => {
  const report = createDemoReport('contact');
  report.findings[0].title = 'untrusted visitor text';
  report.visitorEmail = 'do-not-export@example.org';
  report.sources[0].excerpt = 'untrusted source';
  const exported = exportDemoSummary(report, ['phone', 'injected']);
  const raw = JSON.stringify(exported);
  assert.ok(!raw.includes('untrusted') && !raw.includes('do-not-export') && !raw.includes('injected'));
  assert.ok(exported.recommendations.find(item => item.findingId === 'phone').reviewed);
  assert.equal(exported.recommendations.find(item => item.findingId === 'email').reviewed, false);
  assert.ok(!raw.includes('password=') && !/\b\d{12,19}\b/.test(raw));
  assert.equal(createDemoReport('contact').findings[0].title, 'Personal phone in an old résumé');
});

test('offline demonstration runs without application APIs, environment keys or external assets', async () => {
  const server = createDemoServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const file of ['devfest.html', 'devfest.css', 'devfest-demo.js', 'devfest-fixtures.js']) {
      const response = await fetch(base + '/' + file);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const html = await (await fetch(base + '/devfest.html')).text();
    assert.match(html, /SYNTHETIC DEMO/);
    assert.match(html, /Reset for next visitor/);
    assert.ok(!/src=["']https?:|rel=["']stylesheet["'][^>]*href=["']https?:/i.test(html));
    assert.equal((await fetch(base + '/api/osint/check', { method: 'POST' })).status, 405);
    for (const url of ['/api/auth/me', '/.env.local', '/devfest.html/extra', '/%2e%2e/.env.local']) assert.equal((await fetch(base + url)).status, 404);
    const head = await fetch(base + '/devfest.html', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const js = await readFile(new URL('../frontend/public/devfest-demo.js', import.meta.url), 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML/.test(js));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
