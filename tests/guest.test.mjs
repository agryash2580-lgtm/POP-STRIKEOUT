import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';
test('guest sample needs no signup and registration preserves its publishing destination',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function request(path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'content-type':'application/json',cookie},body:data?JSON.stringify(data):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
 try{const guest=await request('/api/demo/start',{});assert.equal(guest.status,200);assert.equal(guest.data.user.guest,true);const source=await request('/api/source');assert.equal(source.status,200);const account=await request('/api/auth/register',{username:'guest_transfer_'+Date.now(),password:'Synthetic_Guest_2026'});assert.equal(account.status,200);assert.equal(account.data.user.guest,false);assert.equal(account.data.user.workspaceId,guest.data.user.workspaceId);assert.equal((await request('/api/source')).data.base,source.data.base);await fetch(base+'/api/account',{method:'DELETE',headers:{cookie}});}finally{server.close();}
});
