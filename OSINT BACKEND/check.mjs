import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCheck} from './lib/osint.mjs';
try{process.loadEnvFile('.env.local')}catch{}
export async function checkIdentifier(service,value){
 const input=service==='email'?{email:value}:service==='phone'?{phone:value}:service==='linkedin'?{profileUrl:value}:service==='identity_cards'?{fullName:value}:null;
 if(!input)throw Error('Choose email, phone, linkedin or identity_cards.');
 return runCheck({service,input,consent:{selfOwned:true,version:'1',providers:['github_public']}});
}
async function main(){
 const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
 if(!['--service','--value','--output','--consented'].every(x=>args.includes(x)))throw Error('Usage: node check.mjs --service email --value your-email --output reports/check.json --consented');
 const report=await checkIdentifier(value('--service'),value('--value')),path=resolve(value('--output'));
 await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('Public-reference check: '+report.status+'; '+report.findings.length+' confirmed text occurrences. Coverage: public GitHub issues/PRs only.');if(report.status!=='completed')process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Check failed. Verify arguments, consent, provider availability and unused output path. No identifiers or provider secrets are logged.');process.exitCode=1});
