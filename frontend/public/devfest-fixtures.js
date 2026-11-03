// Exhibition fixtures only. Never substitute these for a live API response.
export const demoVersion = '2026-11-02.1';
export const scenarios = Object.freeze([
  {
    id: 'contact', title: 'My old contact details',
    description: 'A fictional portfolio and an old résumé still share contact details.',
    sources: [
      { id: 'portfolio', label: 'Fictional portfolio contact page', location: 'portfolio.example/contact', status: 'completed', excerpt: 'Contact: m•••@example.org · phone ending 0147' },
      { id: 'resume', label: 'Fictional archived résumé', location: 'portfolio.example/archive/resume.pdf', status: 'completed', excerpt: 'Older résumé: personal contact number ending 0147' },
      { id: 'directory', label: 'Fictional community directory', location: 'community.example/directory', status: 'completed', excerpt: 'Public project listing; no matching contact details in this sample.' },
    ],
    findings: [
      { id: 'phone', title: 'Personal phone in an old résumé', severity: 'medium', confidence: 'Exact occurrence in the fictional source', sourceIds: ['resume'], evidence: 'Phone number: [masked; ending 0147]', why: 'A personal number in a public document can enable unwanted contact or tailored scams.', recommendation: 'Remove the personal number from the original résumé, replace the public copy, then request a search-cache refresh if the old version remains indexed.' },
      { id: 'email', title: 'Contact email on a public page', severity: 'low', confidence: 'Exact occurrence in the fictional source', sourceIds: ['portfolio'], evidence: 'Contact email: m•••@example.org', why: 'This may be intentional. Public contact addresses can attract spam and phishing.', recommendation: 'Decide whether this address should be public. Consider a dedicated work address or contact form; enable MFA on the email account.' },
    ],
  },
  {
    id: 'document', title: 'A document shared too widely',
    description: 'A fictional volunteer profile links to a document mentioning an employee badge.',
    sources: [
      { id: 'profile', label: 'Fictional volunteer profile', location: 'community.example/volunteers/mira', status: 'completed', excerpt: 'Volunteer profile: Mira (fictional). Attachment: employee badge document [number hidden].' },
      { id: 'document', label: 'Fictional attachment index', location: 'community.example/attachments', status: 'completed', excerpt: 'Attachment title mentions an employee badge. No identity document is displayed.' },
    ],
    findings: [
      { id: 'badge', title: 'Possible employee-badge reference', severity: 'high', confidence: 'Unverified document-title lead', sourceIds: ['profile', 'document'], evidence: 'Employee badge reference; all identifying fields hidden', why: 'An exposed badge may contain details useful for impersonation. A title alone does not prove that sensitive content is available.', recommendation: 'Privately confirm the source with the document owner. If exposure is real, ask the publisher to remove it and notify the relevant employer security team. Do not repost the document.' },
    ],
  },
  {
    id: 'incomplete', title: 'A source is unavailable',
    description: 'Show how StrikeOut separates a failed check from a negative result.',
    sources: [
      { id: 'portfolio', label: 'Fictional portfolio', location: 'portfolio.example/about', status: 'completed', excerpt: 'No matching identifiers in the checked fictional page.' },
      { id: 'search', label: 'Simulated public search index', location: 'search.example', status: 'unavailable', excerpt: 'Simulated provider timeout. No search results are inferred.' },
    ], findings: [],
  },
  {
    id: 'empty', title: 'No matches in this sample',
    description: 'A completed check with no findings still has limited coverage.',
    sources: [
      { id: 'portfolio', label: 'Fictional project page', location: 'portfolio.example/projects', status: 'completed', excerpt: 'Project descriptions only; no matching personal details in this sample.' },
    ], findings: [],
  },
]);

export function createDemoReport(id) {
  const scenario = scenarios.find(item => item.id === id);
  if (!scenario) throw Error('Choose one of the fictional examples.');
  return {
    schemaVersion: '1', mode: 'synthetic_demonstration', fixtureVersion: demoVersion,
    scenario: scenario.title, scenarioId: scenario.id,
    status: scenario.sources.some(source => source.status !== 'completed') ? 'incomplete' : 'completed',
    coverage: 'Only the bundled fictional sources listed here. No websites, accounts, search engines or private content were accessed.',
    sources: scenario.sources.map(source => ({ ...source, simulated: true })),
    findings: scenario.findings.map(finding => ({ ...finding, sourceIds: [...finding.sourceIds], synthetic: true })),
    limitations: [
      'All examples and findings are fictional. This is not a live assessment.',
      'Severity describes potential impact, not probability, identity verification or a safety score.',
      'No findings within a bounded check does not establish absence of exposure.',
      'MFA protects access to StrikeOut; it does not prove ownership of every search target.',
    ],
  };
}

export function exportDemoSummary(report, reviewedIds = []) {
  // Rebuild from the allowlisted fixture rather than exporting arbitrary UI data.
  const summary = createDemoReport(report.scenarioId);
  const reviewed = new Set(reviewedIds);
  return { ...summary, recommendations: summary.findings.map(finding => ({
    findingId: finding.id, action: finding.recommendation,
    reviewed: reviewed.has(finding.id),
  })) };
}
