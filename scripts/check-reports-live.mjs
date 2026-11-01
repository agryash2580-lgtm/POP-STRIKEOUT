// Fictional case only. No email is sent and no account is created.
import {mkdir, writeFile} from 'node:fs/promises';
import {createGemini, caseSnapshot} from '../api/report-ai.mjs';
import {newCase} from '../api/reporting-core.mjs';
import {reportPDF} from '../api/report-pdf.mjs';
try { process.loadEnvFile('.env.local'); } catch {}
const ai = createGemini();
const incident = newCase({title: 'Fictional account recovery demonstration', category: 'account_takeover', platform: 'Google', description: 'This is a fictional demonstration. I entered my password on a suspicious page and now cannot sign into my Google account. I have not yet tried recovery. The date is unknown. No real person or real account is involved.'});
const snapshot = caseSnapshot(incident, {aiApproved: true, evidenceIds: [], includeFiles: false});
console.log('Checking live search with a generic topic only...');
const research = await ai.research(incident);
console.log('Official sources received:', research.sources.length);
const report = await ai.write(snapshot, research);
const job = {id: incident.id, caseId: incident.id, createdAt: new Date().toISOString(), version: 1, snapshot, research, report};
await mkdir('output/pdf', {recursive: true});
await writeFile('output/pdf/fictional-live-report.pdf', await reportPDF(job));
await writeFile('output/pdf/fictional-live-report.json', JSON.stringify(job, null, 2));
console.log('Gemini writing, validated report and PDF succeeded. Research mode: '+(research.mode||'live_grounding')+'. No email sent.');
