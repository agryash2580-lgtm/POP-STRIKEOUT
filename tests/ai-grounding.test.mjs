import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReport, createGemini} from '../api/report-ai.mjs';
import {chatReplies, validateChatSelection, insufficientEvidence} from '../api/ai-grounding.mjs';

const snapshot = {details:{description:'I report losing access.'}, evidence:[{id:'E1',note:'A message asked for a recovery code.'}]};
const research = {sources:[{id:'S1',excerpts:['Open the official account recovery flow.']},{id:'S2',excerpts:['Keep your evidence.']}]};
const report = {summary:'The attacker is Alex.',observations:[{text:'A message asked for a recovery code.',evidenceIds:['E1']}],unknowns:[],nextSteps:[{id:'recover',title:'Guaranteed recovery',detail:'Open the official account recovery flow.',sourceIds:['S1'],serviceId:'reporting'}],complaintDraft:'The bank refunded everything.'};
const mockAI = value => createGemini({env:{GEMINI_API_KEY:'test'},fetcher:async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})});

test('fabricated narratives and titles never reach report; supplied statements remain attributed',()=>{
 const result=validateReport(report,snapshot,research);
 assert.equal(result.summary,'User-reported account (not independently verified): I report losing access.');
 assert.ok(!JSON.stringify(result).includes('Alex'));
 assert.ok(!JSON.stringify(result).includes('refunded'));
 assert.ok(!JSON.stringify(result).includes('Guaranteed'));
 assert.match(result.complaintDraft,/NOT SUBMITTED/);
});
test('real citation ID cannot launder an invented claim or a quote from another source',()=>{
 for(const detail of ['Your account was recovered.','Keep your evidence.','Open the official account recovery flow. Recovery is guaranteed.'])
  assert.throws(()=>validateReport({...report,nextSteps:[{...report.nextSteps[0],detail}]},snapshot,research),/unsupported guidance/);
});
test('observations must match selected evidence notes and carry the correct evidence ID',()=>{
 for(const observation of [{text:'Alex hacked the account.',evidenceIds:['E1']},{text:'A message asked for a recovery code.',evidenceIds:[]},{text:'A message asked for a recovery code.',evidenceIds:['missing']}])
  assert.throws(()=>validateReport({...report,observations:[observation]},snapshot,research));
 assert.throws(()=>validateReport(report,{...snapshot,evidence:[]},research));
});
test('missing excerpts cannot support guidance even with a valid source ID',()=>{
 assert.throws(()=>validateReport(report,snapshot,{sources:[{id:'S1',excerpts:[]}]}),/unsupported guidance/);
});
test('saved-report help rejects fabricated answers, completed steps, and accepts explicit abstention',async()=>{
 const job={report:validateReport(report,snapshot,research),research};
 await assert.rejects(()=>mockAI({answer:'Recovery succeeded.',sourceIds:['S1'],serviceIds:[]}).help(job,'guidance','',{completedSteps:[]}),/unsupported/);
 const value={answer:'Open the official account recovery flow.',sourceIds:['S1'],serviceIds:['reporting']};
 assert.equal((await mockAI(value).help(job,'guidance','',{completedSteps:[]})).answer,value.answer);
 await assert.rejects(()=>mockAI(value).help(job,'guidance','',{completedSteps:[{stepId:'recover'}]}),/unsupported/);
 assert.equal((await mockAI({answer:insufficientEvidence,sourceIds:[],serviceIds:[]}).help(job,'guidance','',{})).answer,insufficientEvidence);
});
test('Pop only renders reviewed responses: free text, invented IDs and extra claims are rejected',()=>{
 for(const value of [{replyId:'unknown'},{replyId:'recovery'}]) assert.equal(validateChatSelection(value).text,chatReplies[value.replyId]);
 for(const value of [{replyId:'recovery',text:'I recovered your account.'},{replyId:'https://fake.invalid'},'I verified your account.',null])
  assert.throws(()=>validateChatSelection(value),/unsupported guidance/);
});

test('provider adapter rejects research URLs without grounded text and unsupported generated report claims',async()=>{
 const ungrounded = createGemini({env:{GEMINI_API_KEY:'test'},fetcher:async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'Invented recovery guarantee'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://support.google.com/accounts/'}}]}}]})});
 await assert.rejects(()=>ungrounded.research({category:'account_takeover',platform:'Google'}),/usable official or approved security-provider sources/);
 await assert.rejects(()=>mockAI({...report,nextSteps:[{...report.nextSteps[0],detail:'The money was refunded.'}]}).write(snapshot,research),/unsupported guidance/);
});

test('extracting a substring cannot drop negation and reverse guidance',()=>{
 const malicious={...report,nextSteps:[{...report.nextSteps[0],detail:'Share recovery codes.'}]};
 assert.throws(()=>validateReport(malicious,snapshot,{sources:[{id:'S1',excerpts:['Never Share recovery codes.']}]}),/unsupported guidance/);
});

test('fallback report step IDs remain unique and preserve independent progress',()=>{
 const steps=['step_2','INVALID ID','step_2','step_4','INVALID ID'].map(id=>({...report.nextSteps[0],id}));
 const result=validateReport({...report,nextSteps:steps},snapshot,research);
 assert.equal(new Set(result.nextSteps.map(s=>s.id)).size,steps.length);
});
