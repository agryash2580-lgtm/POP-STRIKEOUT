import {isIP} from 'node:net';
import {consent,fail} from './image-url.mjs';
import {serpSearch} from './search-provider.mjs';
import {redactEvidence} from './redact.mjs';
const templates={references:{label:'Exact public reference',suffix:''},pdf:{label:'PDF references',suffix:' filetype:pdf'},documents:{label:'Word document references',suffix:' filetype:docx'},contact:{label:'Contact-page references',suffix:' inurl:contact'},resume:{label:'Résumé references',suffix:' (intitle:resume OR intitle:cv)'},identity:{label:'Possible ID/badge references',suffix:' ("ID card" OR "employee badge")'}};
export function dorkPlan(body){
 consent(body);if(Object.keys(body).some(x=>!['domain','identifier','templates','mode','consent'].includes(x)))fail(400,'Unsupported search fields. Raw dork queries are not accepted.');
 const domain=String(body.domain||'').trim().toLowerCase();
 if(domain.length>253||!domain.includes('.')||isIP(domain)||!domain.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))||/(?:^|\.)(localhost|local|internal|lan|test|invalid|onion)$/.test(domain)||/^\d+$/.test(domain.split('.').at(-1)))fail(400,'Enter a public domain only, without a path, port or search operators.');
 const identifier=typeof body.identifier==='string'?body.identifier.trim():'';
 if(identifier.length<3||identifier.length>254||/[\r\n"<>:\\]|\b(?:site|filetype|inurl|intitle)\s*:/i.test(identifier))fail(400,'Enter your own name, email, username or phone without search operators.');
 const selected=body.templates||['references','pdf'];if(!Array.isArray(selected)||selected.length<1||selected.length>3||selected.some(x=>!Object.hasOwn(templates,x)))fail(400,'Choose one to three supported search templates.');
 return {domain,queries:[...new Set(selected)].map(id=>({id,label:templates[id].label,query:'site:'+domain+' "'+identifier+'"'+templates[id].suffix})),identifier};
}
export async function runDorks(body,{env=process.env,fetcher=fetch}={}){
 const plan=dorkPlan(body),mode=body.mode||'auto';if(!['auto','handoff','api'].includes(mode))fail(400,'Choose auto, handoff or api.');
 const handoffs=plan.queries.map(x=>({...x,url:'https://www.google.com/search?'+new URLSearchParams({q:x.query}),requiresUserAction:true}));
 const report={schemaVersion:'1',service:'google_dorks',checkedAt:new Date().toISOString(),scope:{domain:plan.domain,subdomainsIncluded:true},queries:plan.queries,findings:[],checks:[],limitations:['Only this domain and its subdomains are in scope. Search indexing is incomplete and may be stale.','Search snippets are unverified leads, not proof of identity or exposure. Source pages are not fetched.','These templates do not search for passwords, keys, live cameras or third-party credential dumps.']};
 if(mode==='handoff'||(mode==='auto'&&!env.SERPAPI_API_KEY)){consent(body,'google_search');return {...report,status:'requires_user_search',mode:'handoff',handoffs,coverage:'No automatic Google search ran. Open a prepared query to search Google directly.'}}
 consent(body,'serpapi');if(!env.SERPAPI_API_KEY)fail(503,'SERPAPI_API_KEY is not configured. Use the free Google handoff.');
 const seen=new Set();
 for(const query of plan.queries){
  try{
   const data=await serpSearch({engine:'google',q:query.query,num:'5'},{env,fetcher});
   if(data.organic_results!==undefined&&!Array.isArray(data.organic_results))fail(502,'Search provider returned unexpected results.');
   let accepted=0;
   for(const row of (data.organic_results||[]).slice(0,5)){
    let url;try{url=new URL(row.link)}catch{continue}
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!(url.hostname===plan.domain||url.hostname.endsWith('.'+plan.domain)))continue;
    const text=String(row.title||'')+' '+String(row.snippet||'');if(!text.toLowerCase().includes(plan.identifier.toLowerCase()))continue;
    if(seen.has(url.href))continue;seen.add(url.href);accepted++;
    report.findings.push({category:query.id==='identity'?'possible_identity_document':'public_reference',url:url.href,title:redactEvidence(row.title||'Public reference'),snippet:redactEvidence(row.snippet||''),provider:'serpapi_google',template:query.id,confidence:'exact_occurrence_in_provider_snippet_not_source_verified',reviewPriority:'review'});
   }
   report.checks.push({provider:'serpapi_google',template:query.id,status:'completed',accepted});
  }catch{report.checks.push({provider:'serpapi_google',template:query.id,status:'provider_error'});break}
 }
 const incomplete=report.checks.some(x=>x.status!=='completed');
 return {...report,status:incomplete?'incomplete':'completed',mode:'api',...(body.consent.providers.includes('google_search')?{handoffs}:{}),coverage:'At most five candidates per selected template, filtered to the scoped domain and exact identifier occurrences in returned snippets. No source-page retrieval.'};
}
export const dorkTemplates=Object.entries(templates).map(([id,x])=>({id,label:x.label}));
