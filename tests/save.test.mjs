import test from 'node:test';
import assert from 'node:assert/strict';
import {equal,mergeWorkspace,resolveWorkspaceConflicts} from '../shared/workspace.mjs';
import {read,write,remove} from '../api/store.mjs';
import app from '../api/index.mjs';

const initial={cases:[{id:'case-a',summary:'Original',evidence:[],timeline:[],updatedAt:'2026-10-30T01:00:00Z'}],identifiers:[]};
test('concurrent edits to separate case fields and appended evidence are merged without losing either tab',()=>{
 const mine=structuredClone(initial),theirs=structuredClone(initial);mine.cases[0].summary='My revised account';theirs.cases[0].evidence.push({id:'e1',note:'Independent evidence'});
 mine.cases[0].timeline.push({id:'t1',at:'2026-10-30T01:02:00Z'});theirs.cases[0].timeline.push({id:'t2',at:'2026-10-30T01:01:00Z'});
 const result=mergeWorkspace(initial,mine,theirs);assert.equal(result.conflicts.length,0);assert.equal(result.merged.cases[0].summary,mine.cases[0].summary);assert.deepEqual(result.merged.cases[0].evidence,theirs.cases[0].evidence);assert.deepEqual(result.merged.cases[0].timeline.map(x=>x.id),['t2','t1']);
});
test('same-field conflicts require a choice and choosing the saved field preserves unrelated pending work',()=>{
 const mine=structuredClone(initial),theirs=structuredClone(initial);mine.cases[0].summary='Tab account';mine.cases[0].evidence.push({id:'e1',note:'Keep this'});theirs.cases[0].summary='Saved account';
 const {merged,conflicts}=mergeWorkspace(initial,mine,theirs);assert.equal(conflicts.length,1);assert.equal(conflicts[0].path,'cases[case-a].summary');
 const resolved=resolveWorkspaceConflicts(merged,conflicts,'remote');assert.equal(resolved.cases[0].summary,'Saved account');assert.deepEqual(resolved.cases[0].evidence,mine.cases[0].evidence);
});
test('deletion versus an updated case is retained as an explicit conflict',()=>{
 const theirs=structuredClone(initial);theirs.cases[0].summary='New saved facts';
 const {merged,conflicts}=mergeWorkspace(initial,{cases:[],identifiers:[]},theirs);assert.equal(conflicts.length,1);assert.equal(merged.cases.length,0);assert.equal(resolveWorkspaceConflicts(merged,conflicts,'remote').cases[0].summary,'New saved facts');assert.equal(resolveWorkspaceConflicts(merged,conflicts,'local').cases.length,0);
});
test('local conditional writes reject a stale record instead of silently replacing it',async()=>{
 const key='tests/'+crypto.randomUUID();try{await write(key,{value:'before'});const a=await read(key),b=await read(key);a.value='after';await write(key,a);b.value='stale';await assert.rejects(write(key,b),e=>e.status===409&&e.code==='STORAGE_CONFLICT');assert.equal((await read(key)).value,'after');}finally{await remove(key);}
});
test('simultaneous workspace saves return a recoverable conflict; repeating a successful save is idempotent',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;let cookie='';
 const request=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};
 try{assert.equal((await request('/api/demo/start','POST',{})).status,200);const payload={cases:[{id:'case-a',summary:'A'}],identifiers:[],dataVersion:0};const results=await Promise.all([request('/api/data','PUT',payload),request('/api/data','PUT',{...payload,cases:[{id:'case-b',summary:'B'}]})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);const saved=await request('/api/data');assert.equal(saved.body.dataVersion,1);const repeat=await request('/api/data','PUT',{...saved.body,dataVersion:0});assert.equal(repeat.status,200);assert.equal(repeat.body.dataVersion,1);assert.ok(equal((await request('/api/data')).body,saved.body));}finally{await request('/api/account','DELETE');server.close();}
});
