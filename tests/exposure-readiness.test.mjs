import test from 'node:test';
import assert from 'node:assert/strict';
import { providerBudget } from '../api/osint/request-budget.mjs';
import { flagReport } from '../api/osint/link-risk.mjs';
import { cardReview } from '../api/osint/osint.mjs';

test('one assessment deadline cancels an upstream call and prevents later retries', async () => {
  let attempts = 0;
  const options = providerBudget({ budgetMs: 10, fetcher: (url, { signal }) => {
    attempts++;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  // Keep the test alive while AbortSignal.timeout's unreferenced timer fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(options.fetcher('https://api.github.com/search/issues'), { name: 'TimeoutError' });
    assert.throws(() => options.fetcher('https://api.github.com/search/issues'), { name: 'TimeoutError' });
    assert.equal(attempts, 1);
  } finally { clearTimeout(keepAlive); }
});
test('provider budget respects the shorter per-provider timeout and successful calls', async () => {
  const short = AbortSignal.abort(new DOMException('Provider aborted', 'AbortError'));
  const options = providerBudget({ fetcher: async (url, { signal }) => { signal.throwIfAborted(); return Response.json({ ok: true }); } });
  await assert.rejects(options.fetcher('https://api.github.com/', { signal: short }), { name: 'AbortError' });
  assert.deepEqual(await (await options.fetcher('https://api.github.com/')).json(), { ok: true });
});
test('API reports contain category-specific guidance without copying evidence or claiming remediation', () => {
  for (const category of ['credential_like_assignment', 'payment_card_exposure', 'possible_identity_document', 'breach_membership', 'image_reference', 'public_reference']) {
    const report = flagReport({ findings: [{ category, evidence: 'private-marker-do-not-copy', url: 'https://example.org/doc' }] });
    const recommendations = report.findings[0].recommendations;
    assert.ok(recommendations.length >= 2);
    assert.ok(!JSON.stringify(recommendations).includes('private-marker-do-not-copy'));
    assert.ok(!JSON.stringify(recommendations).includes('has been removed'));
    assert.equal(report.riskSummary.reputationChecked, false);
  }
});
test('local card review masks all but the final four digits', () => {
  const result = cardReview('4242 4242 4242 4242');
  assert.equal(result.masked, '•••• 4242');
  assert.equal(result.luhnValid, true);
  assert.equal(result.externalLookup, false);
  assert.ok(!JSON.stringify(result).includes('4242424242424242'));
});
