import { scenarios, createDemoReport, exportDemoSummary } from './devfest-fixtures.js';

const byId = id => document.getElementById(id);
const scenario = byId('scenario');
let report = null;
let summaryURL = null;
const reviewed = new Set();
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function announce(text) { byId('progress').textContent = text; }
function clearSummary() {
  if (summaryURL) URL.revokeObjectURL(summaryURL);
  summaryURL = null;
  byId('summary-preview').hidden = true;
  byId('summary-text').value = '';
  byId('summary-download').removeAttribute('href');
}
function clearResults() {
  clearSummary();
  report = null;
  reviewed.clear();
  byId('results').hidden = true;
  for (const id of ['metrics', 'sources', 'findings', 'limitations']) byId(id).replaceChildren();
  byId('error').hidden = true;
  byId('error').textContent = '';
}
function describe() {
  const selected = scenarios.find(item => item.id === scenario.value);
  byId('scenario-description').textContent = selected?.description || '';
}
for (const sample of scenarios) {
  const option = element('option', sample.title);
  option.value = sample.id;
  scenario.append(option);
}
describe();
scenario.addEventListener('change', () => {
  clearResults(); byId('consent').checked = false; describe(); announce('Example changed. Confirm the demonstration notice to continue.');
});
byId('assessment').addEventListener('submit', event => {
  event.preventDefault();
  clearResults();
  if (!byId('consent').checked) {
    byId('error').hidden = false;
    byId('error').textContent = 'Confirm that this is a fictional demonstration before continuing.';
    return;
  }
  try {
    report = createDemoReport(scenario.value);
    const completed = report.sources.filter(source => source.status === 'completed').length;
    const unavailable = report.sources.length - completed;
    byId('coverage').textContent = report.coverage;
    for (const [value, label] of [[report.findings.length, 'fictional findings'], [completed, 'simulated sources checked'], [unavailable, 'simulated sources unavailable']]) {
      const card = element('div', undefined, 'metric');
      card.append(element('strong', String(value)), element('span', label));
      byId('metrics').append(card);
    }
    byId('outcome').textContent = report.status === 'incomplete'
      ? 'Incomplete demonstration: a source was unavailable. Do not interpret missing results as absence of exposure.'
      : report.findings.length ? 'Example completed. Review each fictional finding before deciding what action is appropriate.'
      : 'No matches in the checked fictional sample. This is not a clean bill of health or a whole-web assessment.';
    for (const source of report.sources) {
      const card = element('article', undefined, 'source');
      card.append(element('h4', source.label), element('p', source.status === 'completed' ? 'Simulated check completed' : 'Simulated check unavailable', source.status === 'completed' ? 'source-status' : 'unavailable'), element('code', source.location));
      const details = element('details');
      details.append(element('summary', 'Inspect fictional source excerpt'), element('p', source.excerpt));
      card.append(details); byId('sources').append(card);
    }
    if (!report.findings.length) byId('findings').append(element('p', 'No fictional findings to review in this example. Source coverage and limitations still matter.', 'panel'));
    for (const finding of report.findings) {
      const card = element('article', undefined, 'finding');
      card.append(element('span', finding.severity.toUpperCase() + ' · provisional priority', 'severity ' + finding.severity), element('h4', finding.title), element('p', 'Confidence: ' + finding.confidence), element('p', finding.evidence, 'evidence'), element('p', finding.why), element('p', 'Fictional sources: ' + finding.sourceIds.map(id => report.sources.find(source => source.id === id).label).join('; ')));
      card.append(element('h5', 'What you can do'), element('p', finding.recommendation));
      const label = element('label', undefined, 'check');
      const checkbox = element('input'); checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        clearSummary();
        if (checkbox.checked) reviewed.add(finding.id); else reviewed.delete(finding.id);
        announce(reviewed.size + ' of ' + report.findings.length + ' recommendations reviewed. No source was changed.');
      });
      label.append(checkbox, document.createTextNode('I reviewed this recommendation: ' + finding.title));
      card.append(label); byId('findings').append(card);
    }
    for (const text of report.limitations) byId('limitations').append(element('li', text));
    byId('results').hidden = false;
    announce('Fictional demonstration ready. No external services were contacted.');
    byId('results-title').focus();
  } catch {
    report = null; byId('error').hidden = false;
    byId('error').textContent = 'The bundled example could not be loaded. Reset or reload the demonstration. No assessment ran.';
  }
});
byId('export').addEventListener('click', () => {
  if (!report) return;
  clearSummary();
  const text = JSON.stringify(exportDemoSummary(report, [...reviewed]), null, 2);
  summaryURL = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  byId('summary-text').value = text;
  byId('summary-download').href = summaryURL;
  byId('summary-preview').hidden = false;
  announce('Fictional summary prepared. Download the JSON file or copy its text. No visitor information is included.');
  byId('summary-text').focus();
});
byId('reset').addEventListener('click', () => {
  clearResults(); byId('assessment').reset(); describe();
  announce('Demonstration reset. Previous results and recommendation choices have been cleared.');
  scenario.focus();
});
