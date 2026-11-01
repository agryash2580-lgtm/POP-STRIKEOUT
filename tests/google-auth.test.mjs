import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createHash} from 'node:crypto';
import {installGoogleAuth} from '../api/google-auth.mjs';

test('Google login is configuration-gated; configured starts bind state, nonce and PKCE without trusting Host',async()=>{
 const app=express(),records=new Map(),env={};
 installGoogleAuth(app,{env,guarded:fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(e=>res.status(e.status||500).json({error:e.message})),limited(){},fail(status,message){throw Object.assign(Error(message),{status})},read:async k=>records.get(k),write:async(k,v)=>records.set(k,v),remove:async k=>records.delete(k),hash:s=>createHash('sha256').update(s).digest('hex'),seed:()=>({}),session(){throw Error('Must not establish a session')}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await(await fetch(base+'/api/auth/providers')).json()).google,false);
  assert.equal((await fetch(base+'/api/auth/google/start')).status,503);
  Object.assign(env,{GOOGLE_CLIENT_ID:'fictional-client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fictional-test-secret',GOOGLE_REDIRECT_URI:'http://localhost:3002/api/auth/google/callback'});
  const start=await fetch(base+'/api/auth/google/start',{redirect:'manual'});
  const target=new URL(start.headers.get('location'));assert.equal(target.origin,'https://accounts.google.com');assert.equal(target.searchParams.get('redirect_uri'),env.GOOGLE_REDIRECT_URI);assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.ok(target.searchParams.get('nonce'));assert.ok(start.headers.get('set-cookie').includes('HttpOnly'));assert.equal(records.size,1);
  const invalid=await fetch(base+'/api/auth/google/callback?state='+target.searchParams.get('state')+'&code=fictional',{redirect:'manual'});assert.equal(invalid.headers.get('location'),'/?auth-error=google-state');
 }finally{await new Promise(r=>server.close(r))}
});
