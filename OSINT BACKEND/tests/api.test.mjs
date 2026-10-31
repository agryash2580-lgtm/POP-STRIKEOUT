import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../server.mjs';
test('standalone auth, private-account gate, operator isolation and card checks',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'strikeout-osint-')),app=createApp({directory,env:{ALLOWED_ORIGINS:'http://localhost:3002'}}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function call(path,method='GET',body,origin='http://localhost:3002'){const r=await fetch(base+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}
 try{
  assert.equal((await call('/api/osint/capabilities')).status,401);
  assert.equal((await call('/api/auth/register','POST',{username:'customer',password:'SyntheticPassword2026'})).status,200);assert.equal((await call('/api/auth/me')).data.user.username,'customer');
  assert.equal((await call('/api/instagram/operator')).status,403);for(const action of ['connect','view','input','process','close'])assert.equal((await call('/api/instagram/bot/'+action,'POST',{})).status,403);
  for(const accountPrivacy of ['public',undefined])assert.equal((await call('/api/instagram/follow','POST',{username:'synthetic_owner',consent:true,accountPrivacy})).status,400);
  const body={username:'synthetic_owner',consent:true,accountPrivacy:'private'},first=await call('/api/instagram/follow','POST',body),second=await call('/api/instagram/follow','POST',body);assert.equal(first.status,200);assert.equal(first.data.request.status,'queued');assert.equal(second.data.request.id,first.data.request.id);
  assert.equal((await call('/api/osint/check','POST',{service:'payment_cards',input:{number:'4111111111111111'},consent:{selfOwned:true,version:'1',providers:[]}})).data.checks[0].result.masked,'•••• 1111');
  assert.equal((await call('/api/auth/login','POST',{username:'customer',password:'SyntheticPassword2026'},'https://bad.invalid')).status,403);assert.equal((await call('/api/account','DELETE')).status,200);assert.equal((await call('/api/auth/me')).status,401);
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true})}
});
