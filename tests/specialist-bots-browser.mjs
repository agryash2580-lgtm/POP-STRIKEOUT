import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.DESKTOP_TEST_URL||'http://localhost:3019';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let created=false;
try{
 const r=await page.request.post(base+'/api/auth/register',{data:{username:'bots_'+Date.now().toString(36),password:'Fictional-specialist-test-42'}});assert.equal(r.status(),200);created=true;
 await page.goto(base);await page.getByRole('button',{name:'Get help',exact:true}).click();
 const cyber=page.getByRole('region',{name:'Cybersecurity assistant',exact:true}),support=page.getByRole('region',{name:'Emotional-support assistant',exact:true});
 await cyber.getByLabel('Message Cybersecurity assistant',{exact:true}).fill('Fictional test: one safe step for suspicious email?');
 assert.equal(await cyber.getByRole('button',{name:'Send to Cybersecurity assistant',exact:true}).isEnabled(),false);
 await cyber.getByRole('checkbox').check();await cyber.getByRole('button',{name:'Send to Cybersecurity assistant',exact:true}).click();
 await cyber.getByRole('log').getByText('Cybersecurity assistant:',{exact:true}).waitFor({timeout:40000});
 assert.equal(await support.getByRole('log').textContent(),'');
 await support.getByRole('checkbox').check();await support.getByLabel('Message Emotional-support assistant',{exact:true}).fill('Fictional test: I feel stressed. One simple grounding step please.');
 await support.getByRole('button',{name:'Send to Emotional-support assistant',exact:true}).click();await support.getByRole('log').getByText('Emotional-support assistant:',{exact:true}).waitFor({timeout:40000});
 const link=support.getByRole('link',{name:'Open Therabot',exact:false});assert.equal(await link.getAttribute('href'),'https://trytherabot.com/');assert.equal(await link.getAttribute('target'),'_blank');
 await cyber.getByRole('button',{name:'Clear Cybersecurity assistant chat',exact:true}).click();assert.equal(await cyber.getByRole('log').textContent(),'');assert.notEqual(await support.getByRole('log').textContent(),'');
 assert.deepEqual(errors,[]);console.log('PASS: both live bot UI replies, consent gating, separate histories, independent clear and Therabot link; no runtime errors.');
}finally{if(created)await page.request.delete(base+'/api/account');await browser.close();}
