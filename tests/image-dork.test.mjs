import test from 'node:test';
import assert from 'node:assert/strict';
import {reverseImage} from '../api/osint/images.mjs';
import {publicURL,publicAddress,resolvePublic} from '../api/osint/image-url.mjs';
import {dorkPlan,runDorks} from '../api/osint/dorks.mjs';
const approved=providers=>({selfOwned:true,version:'1',providers});
const resolver=async()=>[{address:'93.184.216.34',family:4}];
const image={imageUrl:'https://example.org/photo.png',consent:approved(['google_lens','serpapi'])};
const dorks={domain:'example.org',identifier:'me@example.org',templates:['references','pdf'],consent:approved(['google_search','serpapi'])};
const ok=data=>new Response(JSON.stringify({search_metadata:{status:'Success'},...data}));
test('free image handoff does not contact API or claim a completed search',async()=>{
 let calls=0;const result=await reverseImage(image,{env:{},resolver,fetcher:async()=>{calls++;throw Error('unexpected')}});
 assert.equal(result.status,'requires_user_search');assert.equal(result.findings.length,0);assert.equal(calls,0);assert.equal(new URL(result.handoff.url).hostname,'lens.google.com');assert.equal(new URL(result.handoff.url).searchParams.get('url'),image.imageUrl);
});
test('provider-specific consent is checked before DNS/provider calls',async()=>{
 let calls=0;await assert.rejects(reverseImage({...image,consent:approved([])},{env:{},resolver:async()=>{calls++;return resolver()}}),{status:400});assert.equal(calls,0);
 await assert.rejects(reverseImage({...image,consent:approved(['google_lens'])},{env:{SERPAPI_API_KEY:'test'},resolver}),{status:400});
 await assert.rejects(runDorks({...dorks,consent:approved([])},{env:{}}),{status:400});
});
test('rejects internal, credential, signed and unsupported image URLs',()=>{
 for(const url of ['http://example.org/p','https://127.0.0.1/p','https://[::1]/p','https://user:pass@example.org/p','https://x.local/p','https://example.org:8080/p','https://example.org/p?token=private','file:///tmp/p'])assert.throws(()=>publicURL(url),{status:400});
});
test('address checks exclude private/reserved/mixed DNS',async()=>{
 for(const ip of ['127.0.0.1','10.2.3.4','169.254.169.254','100.64.0.1','192.168.0.1','192.0.2.1','203.0.113.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','2002:7f00:1::'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 await assert.rejects(resolvePublic(image.imageUrl,{resolver:async()=>[...await resolver(),{address:'10.0.0.1',family:4}]}),{status:400});
});
test('image API parses source-linked results, distinguishes exact/visual and redacts',async()=>{
 const result=await reverseImage({...image,mode:'api'},{env:{SERPAPI_API_KEY:'test-key-never-return'},resolver,fetcher:async url=>{
 assert.equal(url.hostname,'serpapi.com');assert.equal(url.searchParams.get('engine'),'google_lens');assert.equal(url.searchParams.get('url'),image.imageUrl);
 return ok({exact_matches:[{link:'https://example.org/post',title:'password=fictional'}],visual_matches:[{link:'https://example.org/post'},{link:'javascript:alert(1)'},{link:'https://other.org/page',title:'Similar'}]});}});
 assert.equal(result.status,'completed');assert.equal(result.findings.length,2);assert.equal(result.findings[0].confidence,'provider_exact_match');assert.equal(result.findings[1].confidence,'provider_visual_similarity');assert.ok(!JSON.stringify(result).includes('test-key-never-return'));assert.ok(!JSON.stringify(result).includes('fictional'));
});
test('provider failures/malformed data are explicit, with consented auto fallback',async()=>{
 const options={env:{SERPAPI_API_KEY:'test'},resolver,fetcher:async()=>new Response('',{status:429})};
 const result=await reverseImage(image,options);assert.equal(result.status,'requires_user_search');assert.equal(result.checks[0].status,'provider_error');
 await assert.rejects(reverseImage({...image,mode:'api'},options),{status:502});
 await assert.rejects(reverseImage({...image,mode:'api'},{env:{},resolver}),{status:503});
 for(const response of [new Response('bad'),ok({error:'failed'}),new Response('x'.repeat(2000001))])await assert.rejects(reverseImage({...image,mode:'api'},{env:{SERPAPI_API_KEY:'test'},resolver,fetcher:async()=>response}),{status:502});
});
test('dorks enforce mandatory scope and reject operator injection and unsafe templates',()=>{
 const plan=dorkPlan(dorks);assert.equal(plan.queries[0].query,'site:example.org "me@example.org"');assert.equal(plan.queries[1].query,'site:example.org "me@example.org" filetype:pdf');
 for(const domain of ['example.org OR site:other.org','https://example.org','localhost','127.0.0.1','example.org/path','-bad.example','example.org:443'])assert.throws(()=>dorkPlan({...dorks,domain}),{status:400});
 for(const identifier of ['x" OR "y','foo\nsite:other.org','site:other.org'])assert.throws(()=>dorkPlan({...dorks,identifier}),{status:400});
 assert.throws(()=>dorkPlan({...dorks,templates:['passwords']}),{status:400});
});
test('keyless Google queries are handoffs, never fabricated backend findings',async()=>{
 const result=await runDorks(dorks,{env:{}});assert.equal(result.status,'requires_user_search');assert.equal(result.handoffs.length,2);assert.equal(result.findings.length,0);assert.equal(new URL(result.handoffs[1].url).searchParams.get('q'),'site:example.org "me@example.org" filetype:pdf');
});
test('automatic dorks filter off-domain and nonexact snippets; partial failures stay incomplete',async()=>{
 let calls=0;const result=await runDorks(dorks,{env:{SERPAPI_API_KEY:'test'},fetcher:async()=>{if(++calls===2)return new Response('',{status:429});return ok({organic_results:[{link:'https://example.org/a',title:'me@example.org',snippet:'password=fictional'},{link:'https://sub.example.org/b',snippet:'me@example.org'},{link:'https://example.org.evil.net/x',snippet:'me@example.org'},{link:'https://elsewhere.org/',snippet:'me@example.org'},{link:'https://example.org/c',snippet:'No exact occurrence'}]})}});
 assert.equal(result.status,'incomplete');assert.equal(result.findings.length,2);assert.equal(result.checks.at(-1).status,'provider_error');assert.ok(!JSON.stringify(result).includes('fictional'));
});

test('Express router enforces account auth and dispatches real dork/image handlers',async()=>{
 const {osintRouter}=await import('../api/osint.mjs');
 const guarded=fn=>async(req,res,next)=>{try{await fn(req,res,next)}catch(e){res.status(e.status||500).json({error:e.message})}};
 const router=osintRouter({user:async req=>{if(req.headers['x-test-auth']!=='yes')throw Object.assign(Error('Sign in'),{status:401});return {id:'qa'}},guarded,limited:()=>{},phoneAuth:{requireVerified:async()=>{}},imageOptions:{env:{},resolver},searchOptions:{env:{}}});
 function send(path,body,auth=true){return new Promise((resolve,reject)=>{
  const req={method:body?'POST':'GET',url:path,headers:auth?{'x-test-auth':'yes'}:{},body};
  const res={statusCode:200,status(code){this.statusCode=code;return this},json(value){resolve({status:this.statusCode,value})}};
  router(req,res,error=>error?reject(error):resolve({status:404}));
 })}
 assert.equal((await send('/dorks',dorks,false)).status,401);
 const d=await send('/dorks',dorks);assert.equal(d.status,200);assert.equal(d.value.status,'requires_user_search');
 const i=await send('/images/reverse',image);assert.equal(i.status,200);assert.equal(i.value.handoff.provider,'google_lens');
 const caps=(await send('/capabilities')).value;assert.ok(caps.dorkTemplates.some(x=>x.id==='pdf'));assert.equal(caps.imageLookup.publicImageUrlOnly,true);
 assert.equal((await send('/dorks',{...dorks,domain:'localhost'})).status,400);
});
