import test from 'node:test';
import assert from 'node:assert/strict';
import {runCheck,runPasswordRange,cardReview} from '../lib/osint.mjs';
import {passwordRange} from '../lib/providers.mjs';
import {parseCSV,auditSavedPasswords} from '../password-audit.mjs';
import {createHash} from 'node:crypto';
const consent={selfOwned:true,version:'1',providers:['brave','hibp']};
test('consent is required and missing credentials never produce invented leads',async()=>{
 await assert.rejects(runCheck({service:'email',input:{email:'me@example.org'},consent:{...consent,selfOwned:false}}));
 const r=await runCheck({service:'linkedin',input:{profileUrl:'https://www.linkedin.com/in/synthetic'},consent},{env:{}});
 assert.equal(r.status,'incomplete');assert.equal(r.findings.length,0);assert.equal(r.checks[0].status,'not_configured');
});
test('exact email search deduplicates valid result URLs and isolates failed providers',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({web:{results:[{url:'https://example.org/team',description:'Public contact'},{url:'https://example.org/team'},{url:'javascript:bad()'}]}}))};
 const r=await runCheck({service:'email',input:{email:'me@example.org'},consent},{env:{BRAVE_SEARCH_API_KEY:'synthetic-key'},fetcher});
 assert.equal(r.status,'incomplete');assert.equal(r.findings.length,1);assert.equal(r.findings[0].confidence,'unverified_search_lead');assert.equal(new URL(calls[0].url).searchParams.get('q'),'"me@example.org"');assert.ok(!JSON.stringify(r).includes('synthetic-key'));
});
test('breach lookup returns metadata and document searches are bounded',async()=>{
 const r=await runCheck({service:'email',input:{email:'me@example.org'},consent:{...consent,providers:['hibp']}},{env:{HIBP_API_KEY:'test'},fetcher:async()=>new Response(JSON.stringify([{Name:'SyntheticBreach',DataClasses:['Email addresses']}]))});
 assert.equal(r.findings[0].category,'breach_membership');
 let count=0;await runCheck({service:'identity_cards',input:{fullName:'Synthetic Person',employer:'Example Corp'},consent:{...consent,providers:['brave']}},{env:{BRAVE_SEARCH_API_KEY:'test'},fetcher:async()=>{count++;return new Response('{"web":{"results":[]}}')}});assert.equal(count,2);
});
test('URL, phone, query injection and secret fields are rejected',async()=>{
 for(const input of [{profileUrl:'https://evil.org/in/me'},{profileUrl:'https://www.linkedin.com/in/me',fullName:'X" OR site:evil'}])await assert.rejects(runCheck({service:'linkedin',input,consent}));
 await assert.rejects(runCheck({service:'phone',input:{phone:'555 123'},consent}));
 await assert.rejects(runCheck({service:'payment_cards',input:{number:'4111111111111111',cvv:'000'},consent}));
});
test('cards are local only, masked and never included verbatim in reports',async()=>{
 const r=await runCheck({service:'payment_cards',input:{number:'4111 1111 1111 1111'},consent:{...consent,providers:[]}},{fetcher:()=>{throw Error('network')}});
 assert.equal(r.checks[0].result.luhnValid,true);assert.equal(r.checks[0].result.masked,'•••• 1111');assert.ok(!JSON.stringify(r).includes('4111'));assert.equal(cardReview('4111111111111112').luhnValid,false);
});
test('password range sends five prefix chars with response padding',async()=>{
 let url,headers;await runPasswordRange({prefix:'ABCDE',consent:{...consent,providers:['pwned_passwords']}},{fetcher:async(u,o)=>{url=u;headers=o.headers;return new Response('A'.repeat(35)+':12\r\n')}});
 assert.equal(url,'https://api.pwnedpasswords.com/range/ABCDE');assert.equal(headers['Add-Padding'],'true');
 await assert.rejects(runPasswordRange({prefix:'ABCDE',password:'do-not-send',consent:{...consent,providers:['pwned_passwords']}}));await assert.rejects(passwordRange('A'.repeat(40)));
});
test('saved-password audit detects reuse and corpus matches without exposing secrets',async()=>{
 const csv='name,url,username,password\n"Example, Inc",https://example.org,user,SyntheticSecret42!\nOther,https://example.org,other,SyntheticSecret42!\n';
 assert.equal(parseCSV(csv)[1][0],'Example, Inc');const digest=createHash('sha1').update('SyntheticSecret42!').digest('hex').toUpperCase();let calls=0;
 const r=await auditSavedPasswords(csv,{consented:true,range:async prefix=>{calls++;assert.equal(prefix,digest.slice(0,5));return digest.slice(5)+':3'}});
 assert.equal(calls,1);assert.equal(r.records[0].breachCount,3);assert.equal(r.records[0].reuseCount,2);
 for(const value of ['SyntheticSecret42!',digest,'example.org','Example, Inc'])assert.ok(!JSON.stringify(r).includes(value));
 const failed=await auditSavedPasswords(csv,{consented:true,range:async()=>{throw Error('offline')}});assert.equal(failed.status,'incomplete');
});
