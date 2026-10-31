import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function createStore(directory=resolve('.data')){
 function path(key){if(!/^[a-z0-9/_-]+$/i.test(key))throw Error('Invalid storage key');return join(directory,key.replaceAll('/','_')+'.json')}
 return {
  async read(key){try{return JSON.parse(await readFile(path(key),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}},
  async write(key,value){await mkdir(directory,{recursive:true,mode:0o700});const destination=path(key),temporary=destination+'.'+randomUUID();try{await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,destination)}finally{await unlink(temporary).catch(()=>{})}},
  async remove(key){await unlink(path(key)).catch(e=>{if(e.code!=='ENOENT')throw e})}
 };
}
