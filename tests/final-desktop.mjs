import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.DESKTOP_TEST_URL||'http://localhost:3002';
await mkdir('output/final',{recursive:true});
try{
 await page.goto(base);await page.getByRole('button',{name:'New here? Create account'}).click();
 await page.getByLabel('STRIKEOUT username').fill('demo_'+Date.now().toString().slice(-8));await page.getByLabel('Password',{exact:true}).fill('fictional-demo-password-42');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByRole('heading',{name:'A place to pick back up.'}).waitFor();
 await page.getByRole('button',{name:'+ New incident'}).click();await page.getByLabel('Give this incident a short title').fill('Fictional Instagram incident');await page.getByLabel('Describe what happened').fill('Fictional demo: someone is using my name on a fake profile. I want to organise my evidence. No real person is involved.');await page.getByRole('button',{name:'Save case & add evidence'}).click();await page.getByRole('heading',{name:'Keep the useful details.'}).waitFor();
 await page.getByLabel('What does this evidence show?').fill('Fictional profile screenshot note.');await page.getByRole('button',{name:'Add evidence',exact:true}).click();await page.getByText('Fictional profile screenshot note.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Complaint draft',exact:true}).click();await page.getByRole('button',{name:'Prepare official-portal draft'}).click();await page.getByLabel('Complaint draft').waitFor();await page.getByRole('button',{name:'I reviewed this exact draft'}).click();await page.getByRole('link',{name:'Download reviewed draft'}).waitFor();
 await page.getByRole('button',{name:'Report & PDF',exact:true}).click();await page.getByLabel('I reviewed this context').check();await page.screenshot({path:'output/final/report-workspace.png'});
 await page.getByRole('button',{name:'Check exposure ↗',exact:true}).click();await page.getByRole('heading',{name:'See what is exposed.'}).waitFor();
 await page.getByRole('button',{name:'Minimize STRIKEOUT / Check Exposure',exact:true}).click();
 await page.getByRole('button',{name:'Delivery & Pop',exact:true}).click();await page.getByRole('heading',{name:'Pop extension settings'}).waitFor();assert.equal(await page.getByRole('link',{name:'Download Chromium ZIP',exact:true}).getAttribute('href'),'/pop-chromium-2.2.0.zip');await page.screenshot({path:'output/final/settings.png'});
 assert.deepEqual(errors,[]);console.log('PASS: actual frontend signup, private case, evidence, reviewed complaint export, report consent, OSINT screen and website Pop settings.');
 await page.request.delete(base+'/api/account');
}catch(error){console.log('Visible website errors:',await page.locator('.error').allTextContents());await page.screenshot({path:'output/final/desktop-failure.png'});throw error;}finally{await browser.close();}
