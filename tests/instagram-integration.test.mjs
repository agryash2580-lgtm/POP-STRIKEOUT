import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';

test('Instagram queue uses the real website session, enforces privacy and consent, and supports withdrawal',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers:{origin:base,...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,value:await r.json()}}
 const before=process.env.ALLOWED_ORIGINS;process.env.ALLOWED_ORIGINS=base;
 try{
  assert.equal((await request('/api/instagram/follow')).status,401);
  const name='ig_test_'+Date.now().toString(36);assert.equal((await request('/api/auth/register','POST',{username:name,password:'fictional-password-42'})).status,200);
  assert.equal((await request('/api/instagram/operator')).status,403);
  assert.equal((await request('/api/instagram/follow','POST',{username:'fictional_demo',accountPrivacy:'public',consent:true})).status,400);
  assert.equal((await request('/api/instagram/follow','POST',{username:'fictional_demo',accountPrivacy:'private',consent:false})).status,400);
  const added=await request('/api/instagram/follow','POST',{username:'fictional_demo',accountPrivacy:'private',consent:true});assert.equal(added.status,200);assert.equal(added.value.request.status,'queued');
  const again=await request('/api/instagram/follow','POST',{username:'fictional_demo',accountPrivacy:'private',consent:true});assert.equal(again.value.request.id,added.value.request.id);
  assert.equal((await request('/api/instagram/follow/'+added.value.request.id+'/withdraw','POST',{})).value.request.status,'withdrawn');
  const removed=await request('/api/account','DELETE');assert.equal(removed.status,200);
 }finally{if(before===undefined)delete process.env.ALLOWED_ORIGINS;else process.env.ALLOWED_ORIGINS=before;await new Promise(r=>server.close(r))}
});
