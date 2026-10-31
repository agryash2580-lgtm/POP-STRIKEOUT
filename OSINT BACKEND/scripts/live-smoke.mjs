// Explicitly invoked live test. Uses public example text, never a user's identifiers.
import {runCheck} from '../lib/osint.mjs';
import {passwordRange} from '../lib/providers.mjs';
const evidence={runAt:new Date().toISOString(),syntheticSubject:'email@example.com',checks:[]};
try{
 const report=await runCheck({service:'email',input:{email:evidence.syntheticSubject},consent:{selfOwned:true,version:'1',providers:['github_public']}},{env:{}});
 evidence.checks.push({provider:'github_public',status:report.status,confirmedOccurrences:report.findings.length,sourceUrls:report.findings.map(x=>x.url)});
}catch{evidence.checks.push({provider:'github_public',status:'failed'})}
try{const result=await passwordRange('5BAA6');evidence.checks.push({provider:'pwned_passwords',status:result?'completed':'failed'})}catch{evidence.checks.push({provider:'pwned_passwords',status:'failed'})}
console.log(JSON.stringify(evidence,null,2));if(evidence.checks.some(x=>x.status!=='completed'))process.exitCode=1;
