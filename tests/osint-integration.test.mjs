import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';
import {runCheck} from '../api/osint/osint.mjs';
import {hash,remove} from '../api/store.mjs';

test('new keyless GitHub integration confirms exact public text and masks sensitive snippets',async()=>{
 const result=await runCheck({service:'email',input:{email:'demo@example.org'},consent:{selfOwned:true,version:'1',providers:['github_public']}},{env:{},fetcher:async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.github.com');assert.equal(options.headers.Authorization,undefined);
  return Response.json({incomplete_results:false,items:[{html_url:'https://github.com/example/project/issues/1',title:'Demo reference',body:'Contact demo@example.org password=FictionalSecret123 card 4111111111111111'},{html_url:'https://github.com/example/project/issues/2',body:'Different identifier'}]});
 }});
 assert.equal(result.status,'completed');assert.equal(result.findings.length,1);assert.match(result.coverage[0].scope,/GitHub/);assert.ok(!JSON.stringify(result).includes('FictionalSecret123'));assert.ok(!JSON.stringify(result).includes('4111111111111111'));
});

test('document review is mounted behind existing authentication and self-ownership consent',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let cookie,owner;
 async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,value:await r.json()};}
 try{
  assert.equal((await request('/api/osint/capabilities')).status,401);
  owner=(await request('/api/demo/start','POST',{})).value.user;
  const caps=await request('/api/osint/capabilities');assert.equal(caps.value.version,'0.2.0');assert.equal(caps.value.providers.github_public,true);assert.equal(caps.value.providers.local_documents,true);
  const body={identifiers:{emails:['demo@example.org'],names:['Demo Person']},documents:[{text:'Employee badge: Demo Person. Contact demo@example.org. password=FictionalSecret123. Card 4111111111111111.'}],consent:{selfOwned:true,version:'1',providers:[]}};
  assert.equal((await request('/api/osint/review-documents','POST',{...body,consent:{selfOwned:false,version:'1'}})).status,400);
  const reviewed=await request('/api/osint/review-documents','POST',body);assert.equal(reviewed.status,200);assert.equal(reviewed.value.kind,'supplied_content_review');assert.ok(reviewed.value.findings.some(f=>f.category==='email_occurrence'));assert.ok(reviewed.value.findings.some(f=>f.category==='credential_like_assignment'));assert.ok(!JSON.stringify(reviewed.value).includes('FictionalSecret123'));
 }finally{if(owner){await remove('users/'+owner.id);await remove('workspaces/'+owner.workspaceId);}if(cookie)await remove('sessions/'+hash(cookie.split('=')[1]));await new Promise(r=>server.close(r));}
});
