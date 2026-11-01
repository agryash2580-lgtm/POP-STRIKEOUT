import test from 'node:test';
import assert from 'node:assert/strict';
import {newCase,generateDraft,draftDigest} from '../api/reporting-core.mjs';
import {emailReviewedComplaint,cyberdostAddress} from '../api/complaint-email.mjs';
function fixture(){const incident=newCase({title:'Fictional email test',category:'impersonation',description:'Fictional details, no real complaint.',email:'private@example.org'});incident.reporting.draft=generateDraft(incident,{targetId:'national_portal',evidenceIds:[],includeContact:false});incident.reporting.draft.approvedDigest=draftDigest(incident.reporting.draft);return incident;}
test('emails only reviewed draft to fixed user-selected address, never automatically records government filing',async()=>{
 const incident=fixture();let sent;
 const mail={configured:()=>true,send:async payload=>{sent=payload;return {status:'accepted'};}};
 const body={confirm:true,text:incident.reporting.draft.text,to:'attacker@example.org'};
 const r=await emailReviewedComplaint(incident,'fictional-owner',body,mail);
 assert.equal(sent.to,cyberdostAddress);assert.equal(sent.text,body.text);assert.ok(!sent.text.includes('private@example.org'));assert.ok(!sent.attachments);assert.equal(r.status,'accepted');assert.deepEqual(incident.reporting.submissions,[]);
 await emailReviewedComplaint(incident,'fictional-owner',body,{configured:()=>true,send:async()=>{throw Error('duplicate send');}});
});
test('missing consent, changed text and stale/unapproved drafts never send',async()=>{
 const mail={configured:()=>true,send:async()=>{throw Error('Must not send');}};
 const incident=fixture(),body={confirm:true,text:incident.reporting.draft.text};
 await assert.rejects(()=>emailReviewedComplaint(incident,'test',{...body,confirm:false},mail),e=>e.status===400);
 await assert.rejects(()=>emailReviewedComplaint(incident,'test',{...body,text:'edited'},mail),e=>e.status===409);
 incident.description='Changed facts';await assert.rejects(()=>emailReviewedComplaint(incident,'test',body,mail),e=>e.status===409);
});
test('unconfigured and failed mail stays unaccepted',async()=>{
 const incident=fixture(),body={confirm:true,text:incident.reporting.draft.text};
 await assert.rejects(()=>emailReviewedComplaint(incident,'test',body,{configured:()=>false}),e=>e.status===503);
 await assert.rejects(()=>emailReviewedComplaint(incident,'test',body,{configured:()=>true,send:async()=>{throw Object.assign(Error('provider failure'),{status:503});}}),e=>e.status===503);
 assert.equal(incident.reporting.draft.cyberdostEmail,undefined);
});
import express from 'express';
import {randomUUID} from 'node:crypto';
import {reportingRouter} from '../api/reporting.mjs';
import {read,write,remove} from '../api/store.mjs';
test('email endpoint isolates cases, checks versions, and saves accepted receipt without submission',async()=>{
 const id=randomUUID(),incident=fixture();await write('users/'+id,{id,cases:[incident],dataVersion:0});let count=0;
 const app=express();app.use(express.json());const guarded=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(e=>res.status(e.status||500).json({error:e.message}));
 app.use(reportingRouter({user:async()=>read('users/'+id),guarded,limited:()=>{},mail:{configured:()=>true,send:async()=>{count++;return {status:'accepted'};}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=async(caseId,dataVersion)=>fetch('http://127.0.0.1:'+server.address().port+'/cases/'+caseId+'/draft/email-cyberdost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataVersion,confirm:true,text:incident.reporting.draft.text})});
 try{
  assert.equal((await call('someone-elses-case',0)).status,404);assert.equal((await call(incident.id,99)).status,409);assert.equal(count,0);
  const sent=await call(incident.id,0);assert.equal(sent.status,200);const result=await sent.json();assert.equal(result.case.reporting.draft.cyberdostEmail.to,cyberdostAddress);assert.deepEqual(result.case.reporting.submissions,[]);
  assert.equal((await call(incident.id,result.dataVersion)).status,200);assert.equal(count,1);
 }finally{await new Promise(r=>server.close(r));await remove('users/'+id);}
});
