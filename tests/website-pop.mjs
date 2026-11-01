// Real Chromium website-to-extension integration. No personal data or AI request.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const base=process.env.DESKTOP_TEST_URL||'http://localhost:3002';
const profile=await mkdtemp(path.join(os.tmpdir(),'pop-website-'));
const extension=path.resolve('extension');
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1440,height:950},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
let created=false;
try{
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const registered=await context.request.post(base+'/api/auth/register',{data:{username:'bridge_'+Date.now().toString(36),password:'fictional-bridge-password-42'}});assert.equal(registered.status(),200);created=true;
 const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());await page.goto(base);
 await page.getByRole('button',{name:'Delivery & Pop',exact:true}).click();
 await page.getByRole('button',{name:'Connect installed Pop',exact:true}).click();
 await page.getByRole('heading',{name:'Your local watchlist',exact:true}).waitFor();
 await page.getByLabel('Identifier', {exact:true}).fill('demo@example.org');
 await page.getByRole('button',{name:'Add identifier',exact:true}).click();
 await page.getByRole('button',{name:'Save Pop preferences',exact:true}).click();
 await page.getByText('Saved to this browser’s Pop extension.',{exact:true}).waitFor();
 const settings=await worker.evaluate(()=>chrome.storage.local.get(['watchlist','sharingGuard']));assert.equal(settings.watchlist[0].value,'demo@example.org');assert.equal(settings.watchlist.length,1);
 const websiteTabId=await worker.evaluate(async(base)=>(await chrome.tabs.query({})).find(t=>t.url?.startsWith(base)).id,base);
 await worker.evaluate(async(tabId)=>chrome.scripting.executeScript({target:{tabId},files:['shared.js','page-scan.js','sharing-guard.js','pet.js']}),websiteTabId);
 await page.waitForSelector('#strikeout-pop-pet',{state:'attached'});assert.equal(await page.locator('#strikeout-pop-pet').evaluate(el=>getComputedStyle(el).display),'none');
 await worker.evaluate(async tabId=>chrome.tabs.sendMessage(tabId,{type:'POP_SHOW'}),websiteTabId);await page.locator('#strikeout-website-pet').waitFor();
 await page.getByRole('button',{name:'Pair Pop AI with my account',exact:true}).click();await page.getByText('Pop is paired with this website.',{exact:true}).waitFor();
 const pairedToken=await worker.evaluate(async()=>(await chrome.storage.local.get('popToken')).popToken);assert.ok(pairedToken);
 await page.getByRole('button',{name:'Disconnect Pop AI',exact:true}).click();await page.getByText('Disconnected Pop AI. Local tools remain available.',{exact:true}).waitFor();assert.equal(await worker.evaluate(async()=>!!(await chrome.storage.local.get('popToken')).popToken),false);
 const revoked=await context.request.post(base+'/api/pop/chat',{headers:{Authorization:'Bearer '+pairedToken},data:{message:'Fictional test; must fail authentication before any AI call.',history:[]}});assert.equal(revoked.status(),401);
 const fixture=await context.newPage();fixture.on('dialog',d=>d.accept());await fixture.goto(base+'/pop-demo.html');
 const fixtureId=await worker.evaluate(async(url)=>(await chrome.tabs.query({})).find(t=>t.url===url).id,base+'/pop-demo.html');
 const panel=await context.newPage();await panel.goto(worker.url().replace('/background.js','/panel.html'));await fixture.bringToFront();
 const handoffPage=context.waitForEvent('page');const reviewed=await panel.evaluate(async tabId=>chrome.runtime.sendMessage({type:'POP_REVIEW_PAGE',tabId}),fixtureId);assert.ok(!reviewed.error,reviewed.error);
 const imported=await handoffPage;await imported.waitForLoadState();await imported.getByLabel('Document text',{exact:true}).waitFor();assert.match(await imported.getByLabel('Document text',{exact:true}).inputValue(),/alex@example.com/);assert.ok(!imported.url().includes('#pop-review='));
 console.log('PASS: website settings, single visible pet, private pairing/revocation, and reviewed page-text handoff.');
}finally{if(created)await context.request.delete(base+'/api/account');await context.close();if(path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('pop-website-'))await rm(profile,{recursive:true,force:true});}
