import express from 'express';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createStore,hash} from './lib/store.mjs';
import {installInstagramBot} from './lib/instagram.mjs';
import {runCheck,runPasswordRange} from './lib/osint.mjs';
try{process.loadEnvFile('.env.local')}catch{}
export function createApp({directory,env=process.env,fetcher=fetch}={}){
 const app=express(),store=createStore(directory),limits=new Map();app.disable('x-powered-by');
 const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
 const origins=new Set(String(env.ALLOWED_ORIGINS||'http://localhost:3002,http://localhost:3010').split(',').map(s=>s.trim()));
 app.use((req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  const origin=req.get('origin');
  if(origin){if(!origins.has(origin))return res.status(403).json({error:'Origin is not approved.'});res.set({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'});}
  if(req.method==='OPTIONS')return res.set({'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}).sendStatus(204);
  if(!['GET','HEAD'].includes(req.method)&&(!origin||req.get('sec-fetch-site')==='cross-site'))return res.status(403).json({error:'Use an approved application origin.'});
  next();
 });
 app.use(express.json({limit:'64kb'}));
 const guarded=fn=>async(req,res,next)=>{try{await fn(req,res,next)}catch(e){if(!res.headersSent)res.status(e.status|| (e.code==='not_configured'?503:e.code==='provider_error'?502:500)).json({error:e.status?e.message:e.code?e.message:'The operation failed. No result has been invented.',...(e.code?{code:e.code}:{})});}};
 function limited(req,scope,max=30){const key=scope+':'+req.socket.remoteAddress,now=Date.now(),v=limits.get(key);if(v&&v.until>now){if(++v.count>max)fail(429,'Too many requests. Please wait a minute.')}else limits.set(key,{count:1,until:now+60000});if(limits.size>2000)for(const [k,v] of limits)if(v.until<now)limits.delete(k)}
 function token(req){return(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('osint_session='))?.slice(14)}
 async function user(req){const raw=token(req);if(!raw)fail(401,'Sign into Strikeout.');const session=await store.read('sessions/'+hash(raw));if(!session||session.expires<Date.now())fail(401,'Your session expired. Sign in again.');const u=await store.read('users/'+session.userId);if(!u)fail(401,'Sign in again.');return u;}
 function safe(u){return{id:u.id,username:u.username,guest:false}}
 async function session(res,id){const raw=randomBytes(32).toString('hex');await store.write('sessions/'+hash(raw),{userId:id,expires:Date.now()+7*86400000});res.cookie('osint_session',raw,{httpOnly:true,sameSite:'strict',secure:env.COOKIE_SECURE==='true',maxAge:7*86400000,path:'/'});}
 app.get('/api/health',(req,res)=>res.json({ok:true,service:'Strikeout OSINT Backend',version:'0.1.0'}));
 app.post('/api/auth/:action',guarded(async(req,res)=>{
  limited(req,'auth',12);const action=req.params.action;
  if(action==='logout'){const raw=token(req);if(raw)await store.remove('sessions/'+hash(raw));res.clearCookie('osint_session',{path:'/'});return res.json({ok:true});}
  const username=String(req.body.username||'').toLowerCase(),password=req.body.password;
  if(!/^[a-z0-9_-]{3,32}$/.test(username)||typeof password!=='string'||password.length<10||password.length>128)fail(400,'Use a 3–32 character Strikeout username and a new password of 10–128 characters.');
  const id=hash(username);if(action==='register'&&registrations.has(id))fail(409,'Registration in progress.');
  if(action==='register')registrations.add(id);
  let u;try{u=await store.read('users/'+id);
  if(action==='register'){
   if(u)fail(409,'Username already registered.');const salt=randomBytes(16).toString('hex');u={id,username,salt,password:scryptSync(password,salt,64).toString('hex'),guest:false};
   await store.write('users/'+id,u);
  }else if(action==='login'){
   if(!u||!timingSafeEqual(Buffer.from(u.password,'hex'),scryptSync(password,u.salt,64)))fail(401,'Username or password did not match.');
  }else fail(404,'Unknown authentication action.');
  }finally{if(action==='register')registrations.delete(id)}
  await session(res,id);res.json({user:safe(u)});
 }));
 const registrations=new Set();
 app.get('/api/auth/me',guarded(async(req,res)=>res.json({user:safe(await user(req))})));
 app.delete('/api/account',guarded(async(req,res)=>{const u=await user(req);await instagram.removeUser(u.id);await store.remove('users/'+u.id);const raw=token(req);if(raw)await store.remove('sessions/'+hash(raw));res.clearCookie('osint_session',{path:'/'});res.json({deleted:true});}));
 app.get('/api/osint/capabilities',guarded(async(req,res)=>{await user(req);res.json({services:['linkedin','email','phone','identity_cards','payment_cards','saved_passwords'],providers:{brave:!!env.BRAVE_SEARCH_API_KEY,hibp:!!env.HIBP_API_KEY,pwned_passwords:true},instagram:{service:'popyourproblemsaway',privateAccountsOnly:true,privacyIsSelfDeclaredUntilBotCheck:true},reportStorage:'none',privateContentScanning:false});}));
 app.post('/api/osint/check',guarded(async(req,res)=>{await user(req);limited(req,'osint',6);res.json(await runCheck(req.body,{env,fetcher}));}));
 app.post('/api/osint/passwords/range',guarded(async(req,res)=>{await user(req);limited(req,'passwords',30);res.json(await runPasswordRange(req.body,{fetcher}));}));
 const instagram=installInstagramBot(app,{user,guarded,fail,limited,...store,hash,env});
 app.use((error,req,res,next)=>res.status(error.type==='entity.too.large'?413:400).json({error:'Invalid or oversized request body.'}));
 return app;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3010);createApp().listen(port,'127.0.0.1',()=>console.log('OSINT backend listening on http://localhost:'+port));
}
