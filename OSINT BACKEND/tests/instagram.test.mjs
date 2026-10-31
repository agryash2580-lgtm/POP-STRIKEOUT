import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest,sendFollow} from '../lib/instagram.mjs';
import {prepare} from '../lib/identifiers.mjs';
function fake({identity='reviewer',existing=false,outcome='Requested',clickFails=false}={}){
 let current='',clicks=0;
 const state={get clicks(){return clicks}};
 const control={count:async()=>1,click:async()=>{clicks++;if(clickFails)throw Error('interrupted')}};
 const pending={count:async()=>clicks&&outcome==='Requested'?1:0,or:()=>({first:()=>({waitFor:async()=>{if(outcome==='unknown')throw Error('timeout')}})})};
 const header={getByRole:(_role,options)=>{
  if(options.name instanceof RegExp)return {count:async()=>existing?1:0};
  if(options.name==='Follow')return control;
  if(options.name==='Requested')return pending;
  return {count:async()=>outcome==='Following'?1:0};
 }};
 const page={goto:async url=>{current=url},url:()=>current,
  getByText:()=>({count:async()=>0}),
  getByRole:(role,options)=>role==='button'?{all:async()=>[],first:()=>({waitFor:async()=>{if(outcome==='unknown')throw Error('timeout')}})}:({first:()=>({waitFor:async()=>{}}),evaluateAll:async()=>['https://www.instagram.com/'+identity+'/']}),
  locator:()=>header};
 return {page,state};
}
test('requires active consent no older than 24h',()=>{
 for(const r of [null,{...prepare('alice','reviewer',true),status:'revoked'},{...prepare('alice','reviewer',true),consentAt:'bad'},{...prepare('alice','reviewer',true),consentAt:'2020-01-01'}])assert.throws(()=>validateRequest(r));
});
test('wrong signed-in identity never clicks',async()=>{
 const {page,state}=fake({identity:'someone_else'});
 await assert.rejects(sendFollow(page,prepare('alice','reviewer',true),async()=>{}),/does not match/);assert.equal(state.clicks,0);
});
test('existing follow never toggles or clicks',async()=>{
 const {page,state}=fake({existing:true});
 const receipt=await sendFollow(page,prepare('alice','reviewer',true),async()=>{throw Error('must not mark an attempt')});
 assert.equal(receipt.status,'already_present');assert.equal(state.clicks,0);
});
test('one click only after persisted consent check; observes Requested',async()=>{
 const {page,state}=fake();let persisted=false;
 const receipt=await sendFollow(page,prepare('alice','reviewer',true),async()=>{assert.equal(state.clicks,0);persisted=true});
 assert.ok(persisted);assert.equal(state.clicks,1);assert.equal(receipt.status,'requested');
});
test('revoked consent before click prevents mutation',async()=>{
 const {page,state}=fake();await assert.rejects(sendFollow(page,prepare('alice','reviewer',true),async()=>{throw Error('consent revoked')}));assert.equal(state.clicks,0);
});
test('ambiguous click returns needs_check without retry',async()=>{
 const {page,state}=fake({clickFails:true});const receipt=await sendFollow(page,prepare('alice','reviewer',true),async()=>{});
 assert.equal(receipt.status,'needs_check');assert.equal(state.clicks,1);
});
test('recovers a closed Instagram tab using the replacement tab',async()=>{
 const {recoverPage}=await import('../lib/instagram.mjs');
 const replacement={isClosed:()=>false,url:()=>'https://www.instagram.com/',setDefaultTimeout:()=>{},setDefaultNavigationTimeout:()=>{}};
 const session={browser:{isConnected:()=>true},page:{isClosed:()=>true},context:{pages:()=>[replacement]}};
 assert.equal(await recoverPage(session),replacement);assert.equal(session.page,replacement);
});
test('a disconnected browser produces a useful reconnect error',async()=>{
 const {recoverPage}=await import('../lib/instagram.mjs');
 await assert.rejects(recoverPage({browser:{isConnected:()=>false}}),/operator page/);
});
test('mobile Follow outside header excludes suggested accounts',async()=>{
 const {profileControl}=await import('../lib/instagram.mjs');
 const target={boundingBox:async()=>({y:300})},suggested={boundingBox:async()=>({y:600})};
 const page={locator:()=>({getByRole:()=>({count:async()=>0})}),
 getByText:text=>text==='alice'?{count:async()=>1}:{count:async()=>1,first:()=>({boundingBox:async()=>({y:450})})},
 getByRole:()=>({all:async()=>[target,suggested]})};
 assert.equal(await profileControl(page,'alice','Follow'),target);
 page.getByRole=()=>({all:async()=>[suggested]});assert.equal(await profileControl(page,'alice','Follow'),null);
});
test('private declaration alone is insufficient without Instagram privacy evidence',async()=>{
 const {page,state}=fake();const record={...prepare('alice','reviewer',true),accountPrivacy:'private'};
 const receipt=await sendFollow(page,record,async()=>{throw Error('must not click')});
 assert.equal(receipt.status,'privacy_unconfirmed');assert.equal(state.clicks,0);
});
