import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {passwordRange} from './lib/providers.mjs';
export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('Malformed CSV quotes.');if(field||row.length){row.push(field);rows.push(row)}return rows;
}
export async function auditSavedPasswords(csv,{consented=false,range=passwordRange}={}){
 if(!consented)throw Error('Explicit consent to check your own saved passwords is required.');
 if(Buffer.byteLength(csv)>2000000)throw Error('CSV exceeds 2 MB limit.');
 const rows=parseCSV(csv),header=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase())||[],column=header.indexOf('password');
 if(column<0||rows.length>500)throw Error('Use a CSV with a password column, at most 500 rows.');
 const digests=rows.map(row=>row[column]?createHash('sha1').update(row[column],'utf8').digest('hex').toUpperCase():null);
 const prefixes=[...new Set(digests.filter(Boolean).map(x=>x.slice(0,5)))];if(prefixes.length>100)throw Error('At most 100 unique hash-prefix requests per audit. Split your export.');
 const counts=new Map();for(const digest of digests.filter(Boolean))counts.set(digest,(counts.get(digest)||0)+1);
 const ranges=new Map(),errors=new Set();
 for(const prefix of prefixes){try{ranges.set(prefix,await range(prefix))}catch{errors.add(prefix)}}
 return {schemaVersion:'1',service:'saved_passwords',checkedAt:new Date().toISOString(),status:errors.size?'incomplete':'completed',records:digests.map((digest,i)=>{
  if(!digest)return {row:i+2,status:'no_password'};
  const prefix=digest.slice(0,5);if(errors.has(prefix))return {row:i+2,status:'provider_error',reuseCount:counts.get(digest)};
  const line=ranges.get(prefix).split(/\r?\n/).find(line=>line.startsWith(digest.slice(5)+':')),appearances=line?Number(line.split(':')[1]):0;
  return {row:i+2,status:appearances>0?'found_in_breach_corpus':'not_found_in_dataset',breachCount:appearances,reuseCount:counts.get(digest)};
 }),limitations:['Only five SHA-1 prefix characters are sent to Pwned Passwords. Passwords, full hashes, account names and URLs are not uploaded or included in this report.','A corpus match concerns the password string, not proof that this particular saved account was breached.','No match is not proof of a strong or safe password. Reuse is computed locally.']};
}
async function main(){
 const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
 if(!args.includes('--input')||!args.includes('--output')||!args.includes('--consented'))throw Error('Usage: node password-audit.mjs --input /private/export.csv --output reports/audit.json --consented');
 const report=await auditSavedPasswords(await readFile(resolve(arg('--input')),'utf8'),{consented:true});
 const output=resolve(arg('--output'));await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Audit saved. Status: '+report.status);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Audit could not finish. Check the arguments, private input CSV, provider access and unused output path. No password data is logged.');process.exitCode=1});
