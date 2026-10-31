import test from 'node:test';import assert from 'node:assert/strict';
import {runCheck} from '../lib/osint.mjs';import {reviewDocuments} from '../lib/documents.mjs';
import {extractDocument} from '../document-audit.mjs';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const consent={selfOwned:true,version:'1',providers:['github_public']};
test('no-key email check returns only verified exact provider text and redacts secrets',async()=>{
 let headers;const r=await runCheck({service:'email',input:{email:'me@example.org'},consent},{env:{},fetcher:async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.github.com');assert.equal(new URL(url).searchParams.get('q'),'"me@example.org" in:body');headers=options.headers;
  return new Response(JSON.stringify({incomplete_results:false,items:[{html_url:'https://github.com/example/project/issues/1',body:'Contact me@example.org password=MustNotAppear42 card 4111111111111111',title:'Public contact'},{html_url:'https://github.com/example/project/issues/2',body:'a different person'},{html_url:'https://evil.org/project/issues/1',body:'me@example.org'}]}));
 }});
 assert.equal(r.status,'completed');assert.equal(r.findings.length,1);assert.equal(r.findings[0].confidence,'exact_occurrence_in_public_provider_text');assert.equal(headers.Authorization,undefined);
 assert.ok(!JSON.stringify(r).includes('MustNotAppear42'));assert.ok(!JSON.stringify(r).includes('4111111111111111'));assert.match(r.coverage[0].scope,/GitHub/);
});
test('keyless phone, LinkedIn and identity checks use distinct validated subjects',async()=>{
 for(const [service,input] of [['phone',{phone:'+12025550123'}],['linkedin',{profileUrl:'https://www.linkedin.com/in/synthetic-person'}],['identity_cards',{fullName:'Synthetic Person'}]]){
  const report=await runCheck({service,input,consent},{env:{},fetcher:async()=>new Response(JSON.stringify({items:[],incomplete_results:false}))});assert.equal(report.status,'completed');assert.ok(report.checks.some(x=>x.provider==='github_public'));
 }
});
test('GitHub timeout results and provider failures are visibly incomplete',async()=>{
 const body={service:'email',input:{email:'me@example.org'},consent};
 const partial=await runCheck(body,{env:{},fetcher:async()=>new Response('{"items":[],"incomplete_results":true}')});assert.equal(partial.status,'incomplete');
 const failure=await runCheck(body,{env:{},fetcher:async()=>new Response('{}',{status:429})});assert.equal(failure.status,'incomplete');assert.equal(failure.findings.length,0);
});
test('document evidence finds email, formatted phone, LinkedIn, credentials, cards and badge terms offline',()=>{
 const secret='NeverIncludeThisSecret42';const body={consent,identifiers:{emails:['me@example.org'],phones:['+12025550123'],linkedinProfiles:['https://www.linkedin.com/in/synthetic-person'],names:['Synthetic Person']},documents:[{text:'Employee badge: Synthetic Person\nEmail: me@example.org\nPhone: +1 (202) 555-0123\nhttps://www.linkedin.com/in/synthetic-person\npassword='+secret+'\nCard: 4111111111111111',sourceUrl:'https://example.org/resume?token=do-not-include'}]};
 const report=reviewDocuments(body),categories=new Set(report.findings.map(x=>x.category));
 for(const c of ['email_occurrence','phone_occurrence','linkedin_reference','credential_like_assignment','payment_card_exposure','possible_identity_document'])assert.ok(categories.has(c),c);
 for(const raw of [secret,'4111111111111111','do-not-include'])assert.ok(!JSON.stringify(report).includes(raw));assert.equal(report.documentsReviewed,1);
 assert.throws(()=>reviewDocuments({...body,consent:{selfOwned:false,version:'1'}}));
});
test('text and PDF files can be reviewed without uploaded files or provider keys',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'osint-document-'));
 try{
  const textPath=join(directory,'own.txt');await writeFile(textPath,'Email: me@example.org');assert.match(await extractDocument(textPath),/me@example.org/);
  const stream='BT /F1 12 Tf 72 720 Td (Email: me@example.org) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const pdfPath=join(directory,'own.pdf');await writeFile(pdfPath,pdf);assert.match(await extractDocument(pdfPath),/me@example.org/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
