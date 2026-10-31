import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {extname,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {reviewDocuments} from './lib/documents.mjs';
export async function extractDocument(path){
 const info=await stat(path);if(info.size>5000000)throw Error('Document exceeds 5 MB.');
 const data=await readFile(path);
 if(extname(path).toLowerCase()!=='.pdf')return data.toString('utf8');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const standardFontDataUrl=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))+'/standard_fonts/';
 const task=getDocument({standardFontDataUrl,data:new Uint8Array(data),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:true});
 try{
  const pdf=await task.promise;if(pdf.numPages>40)throw Error('PDF exceeds 40 pages.');
  const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(content.items.map(item=>item.str||'').join(' '));}
  const text=pages.join('\n');if(!text.trim())throw Error('No extractable PDF text. OCR is not implemented.');return text;
 }finally{await task.destroy()}
}
async function main(){
 const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
 if(!args.includes('--input')||!args.includes('--identifiers')||!args.includes('--output')||!args.includes('--consented'))throw Error('Usage: node document-audit.mjs --input /private/resume.pdf --identifiers /private/own-identifiers.json --output reports/document.json --consented');
 const identifiers=JSON.parse(await readFile(resolve(value('--identifiers')),'utf8'));
 const report=reviewDocuments({documents:[{text:await extractDocument(resolve(value('--input')))}],identifiers,consent:{selfOwned:true,version:'1'}});
 const path=resolve(value('--output'));await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Document review saved: '+report.findings.length+' findings.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Document review failed. Check the local input, identifiers, supported PDF/text format and unused output path. Document contents are not logged.');process.exitCode=1});
