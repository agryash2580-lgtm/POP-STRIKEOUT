import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const base=process.env.DESKTOP_TEST_URL||'http://localhost:3002';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));let created=false;
try{
 const registered=await page.request.post(base+'/api/auth/register',{data:{username:'exposure_'+Date.now().toString(36),password:'fictional-exposure-password-42'}});assert.equal(registered.status(),200);created=true;
 await page.goto(base+'/exposure');
 const exposure=page.locator('.exposure-window');
 await exposure.getByLabel('Check type',{exact:false}).selectOption('documents');
 // Use the real generated sample when available. Extracting PDF text is browser-local.
 if(process.env.PDF_TEST_FILE){await exposure.locator('input[type=file]').setInputFiles(process.env.PDF_TEST_FILE);await page.waitForFunction(()=>document.querySelector('.exposure-window textarea')?.value.length>100||document.querySelector('.exposure-window .error'));assert.ok((await exposure.getByLabel('Document text',{exact:true}).inputValue()).length>100,(await exposure.locator('.error').allTextContents()).join(' '));console.log('PASS: real PDF text extraction with the bundled local worker.');}
 await exposure.getByLabel('Document text',{exact:true}).fill('Fictional document: demo@example.org. password=FictionalSecret123. Employee badge: Demo Person.');
 await exposure.getByLabel('Your emails to find', {exact:false}).fill('demo@example.org');
 await exposure.getByLabel('This is my information',{exact:false}).check();
 await exposure.getByRole('button',{name:'Check my exposure',exact:true}).click();
 await exposure.getByRole('heading',{name:'Check completed',exact:true}).waitFor();
 const findings=await exposure.locator('.step-card').allTextContents();assert.ok(findings.some(x=>x.includes('email')));assert.ok(!findings.join(' ').includes('FictionalSecret123'));
 const downloadPromise=page.waitForEvent('download');await exposure.getByRole('button',{name:'Download exposure results',exact:true}).click();const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.ok(exported.findings.length);assert.ok(!JSON.stringify(exported).includes('FictionalSecret123'));
 await exposure.locator('.instagram-panel > summary').click();
 await exposure.getByLabel('My account is',{exact:false}).selectOption('private');
 await exposure.getByLabel('My Instagram username',{exact:true}).fill('fictional_demo_example');
 await exposure.getByLabel('This account is mine.',{exact:false}).check();
 await exposure.getByRole('button',{name:'Request Pop follow',exact:true}).click();await exposure.getByText('Status: queued',{exact:true}).waitFor();
 await exposure.getByRole('button',{name:'Withdraw permission',exact:true}).click();await exposure.getByText('Status: withdrawn',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Minimize STRIKEOUT / Check Exposure',exact:true}).click();
 await page.getByRole('button',{name:'+ New incident',exact:true}).click();
 await page.getByLabel('Give this incident a short title').fill('Fictional PDF demonstration');await page.getByLabel('Describe what happened').fill('Fictional demonstration only. I want to organise an account incident.');await page.getByRole('button',{name:'Save case & add evidence',exact:true}).click();
 await page.getByRole('button',{name:'Report & PDF',exact:true}).click();await page.getByRole('button',{name:'Create local report & PDF (no AI)',exact:true}).click();
 const link=page.getByRole('link',{name:'Download PDF ↓',exact:true});await link.waitFor();const pdf=await page.request.get(new URL(await link.getAttribute('href'),base).href);assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
 await mkdir('output/final',{recursive:true});await page.screenshot({path:'output/final/local-report-ready.png'});assert.deepEqual(errors,[]);
 console.log('PASS: supplied-document scan, masked JSON export, local Instagram consent queue/withdrawal and real downloadable local-report PDF. No follow or email sent.');
}finally{if(created)await page.request.delete(base+'/api/account');await browser.close();}
