import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini, officialURL, researchURL, validateReport } from '../api/report-ai.mjs';
import { newCase } from '../api/reporting-core.mjs';

test('research quota fallback identifies the cause without pretending to retrieve sources', async () => {
  const ai = createGemini({env:{GEMINI_API_KEY:'fictional-key'},fetcher:async()=>Response.json({}, {status:429})});
  const research = await ai.research({platform:'Instagram',category:'account_takeover'});
  assert.equal(research.mode,'bundled_official_references');
  assert.equal(research.unavailabilityReason,'quota_exhausted');
  assert.match(research.limitation,/quota was exhausted/);
  assert.ok(research.sources.every(source=>source.retrievedAt.includes('not fetched')));
});

test('2.5 research reserves output budget and retains checked live citations', async () => {
  let request;
  const ai = createGemini({env:{GEMINI_API_KEY:'fictional-key',GEMINI_RESEARCH_MODEL:'gemini-2.5-flash'},fetcher:async(url,options)=>{
    request=JSON.parse(options.body);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'Use official account recovery.'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://www.instagram.com/hacked/',title:'Instagram recovery'}}],groundingSupports:[{groundingChunkIndices:[0],segment:{text:'Use official account recovery.'}}]}}]});
  }});
  const research=await ai.research({platform:'Instagram',category:'account_takeover'});
  assert.equal(request.generationConfig.thinkingConfig.thinkingBudget,0);
  assert.equal(research.sources[0].url,'https://www.instagram.com/hacked/');
  assert.equal(research.limitation,undefined);
});

test('incident dates reject the year 4000 while unknown dates remain allowed', () => {
  const details={title:'Fictional incident',description:'A fictional account incident.',platform:'Instagram',category:'account_takeover'};
  assert.throws(()=>newCase({...details,occurredOn:'4000-07-05'}),/cannot be in the future/);
  assert.equal(newCase(details).occurredOn,'');
  assert.equal(newCase({...details,occurredOn:'2020-01-01'}).occurredOn,'2020-01-01');
});

test('official Meta recovery sources are accepted without allowing lookalike hosts', () => {
  assert.equal(officialURL('https://www.meta.com/account-recovery-support/'),true);
  assert.equal(officialURL('https://meta.com.attacker.invalid/account-recovery-support/'),false);
});

test('vetted security publishers stay distinct from official sources and reject spoofed domains', () => {
  assert.equal(researchURL('https://www.eset.com/blog/recovery/'),true);
  assert.equal(officialURL('https://www.eset.com/blog/recovery/'),false);
  assert.equal(researchURL('https://www.mcafee.com/blogs/recovery/'),true);
  assert.equal(researchURL('https://eset.com.attacker.invalid/recovery/'),false);
  assert.equal(researchURL('https://random-recovery-agent.example/'),false);
});

test('quota failure can retrieve current publisher text without calling it Google Search', async () => {
  const excerpt='Use Instagram account recovery through the official app and secure your email account.';
  const requests=[];
  const ai=createGemini({env:{GEMINI_API_KEY:'fictional-key'},fetcher:async(url)=>{
    requests.push(String(url));
    if(String(url).includes('generativelanguage.googleapis.com'))return Response.json({}, {status:429});
    return new Response('<h1>Recovery guidance</h1><article><p>'+excerpt+'</p></article>',{headers:{'Content-Type':'text/html'}});
  }});
  const research=await ai.research({platform:'Instagram',category:'account_takeover'});
  assert.equal(research.mode,'live_source_retrieval');
  assert.equal(research.sources[0].excerpts[0],excerpt);
  assert.equal(research.sources[0].kind,'security_vendor');
  assert.match(research.limitation,/No fresh Google Search results/);
  assert.equal(requests.length,2);
});

test('report selection inserts stored excerpts and evidence instead of model paraphrases', () => {
  const snapshot={details:{description:'Fictional account incident.'},evidence:[{id:'E1',note:'A fictional selected evidence note.'}]};
  const research={sources:[{id:'S1',excerpts:['Use the official recovery flow.']}]};
  const value={summary:'',complaintDraft:'',unknowns:[],observations:[{evidenceIds:['E1']}],nextSteps:[{id:'step1',serviceId:'reporting',sourceIds:['S1'],excerptIndex:0,detail:'Invented model paraphrase'}]};
  const result=validateReport(value,snapshot,research);
  assert.equal(result.nextSteps[0].detail,research.sources[0].excerpts[0]);
  assert.equal(result.observations[0].text,snapshot.evidence[0].note);
  assert.throws(()=>validateReport({...value,nextSteps:[{...value.nextSteps[0],excerptIndex:99}]},snapshot,research),/invalid source excerpt/);
});
