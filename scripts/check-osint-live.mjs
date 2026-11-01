// Reserved example identifiers only. Never pass personal data through command-line arguments.
import {runCheck,runPasswordRange} from '../api/osint/osint.mjs';
const consent={selfOwned:true,version:'1',providers:['github_public']};
for(const [service,input] of [['email',{email:'demo@example.org'}],['instagram',{username:'fictional_demo_example'}]]) {
 const result=await runCheck({service,input,consent});
 console.log(JSON.stringify({service,status:result.status,findings:result.findings.length,checks:result.checks.map(c=>({provider:c.provider,status:c.status}))}));
 if(result.status!=='completed')process.exitCode=1;
}
const passwords=await runPasswordRange({prefix:'5BAA6',consent:{selfOwned:true,version:'1',providers:['pwned_passwords']}});
console.log('Password-prefix provider returned '+passwords.range.split(/\r?\n/).filter(Boolean).length+' candidate suffixes. Matching remains local.');
