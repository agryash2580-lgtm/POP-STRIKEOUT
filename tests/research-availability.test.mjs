import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini, officialURL } from '../api/report-ai.mjs';
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
