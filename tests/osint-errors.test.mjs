import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from '../api/osint/providers.mjs';
import {runCheck} from '../api/osint/osint.mjs';
test('provider transient failures retry once and never invent a result',async()=>{let attempts=0;const result=await request('https://api.github.com/test',{fetcher:async()=>{if(++attempts===1)throw Error('temporary network failure');return Response.json({ok:true})}});assert.equal(result.ok,true);assert.equal(attempts,2);});
test('GitHub rate limits keep GitHub coverage and a useful retry message',async()=>{const result=await runCheck({service:'instagram',input:{username:'fictional_demo'},consent:{selfOwned:true,version:'1',providers:['github_public']}},{fetcher:async()=>Response.json({message:'rate limited'},{status:403,headers:{'x-ratelimit-remaining':'0','retry-after':'60'}})});assert.equal(result.status,'incomplete');assert.equal(result.coverage[0].status,'rate_limited');assert.equal(result.coverage[0].retryAfter,60);assert.match(result.coverage[0].scope,/GitHub/);assert.ok(!result.coverage[0].scope.includes('Brave'));assert.match(result.coverage[0].message,/request limit/);});
