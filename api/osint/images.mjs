import {consent,fail,resolvePublic,publicURL} from './image-url.mjs';
import {redactEvidence} from './redact.mjs';
import {serpSearch} from './search-provider.mjs';
function resultURL(value){try{return publicURL(value).href}catch{return null}}
export async function reverseImage(body,{env=process.env,fetcher=fetch,resolver}={}){
 consent(body);if(Object.keys(body).some(x=>!['imageUrl','mode','consent'].includes(x)))fail(400,'Provide an imageUrl, mode and consent only. Local images are not uploaded automatically.');
 const mode=body.mode||'auto';if(!['auto','handoff','api'].includes(mode))fail(400,'Choose auto, handoff or api.');
 const handoffOnly=mode==='handoff'||(mode==='auto'&&!env.SERPAPI_API_KEY);
 if(mode==='api'&&!env.SERPAPI_API_KEY)fail(503,'Automatic image results require SERPAPI_API_KEY.');
 consent(body,handoffOnly?'google_lens':'serpapi');
 // Reject non-public/signed URLs before they are disclosed to any provider.
 const {url}=await resolvePublic(body.imageUrl,{...(resolver?{resolver}:{})});
 const handoff={provider:'google_lens',url:'https://lens.google.com/uploadbyurl?url='+encodeURIComponent(url.href),requiresUserAction:true,disclosure:'Opening this link shares the image URL and may cause Google to fetch the image. Results remain on Google; they are not imported into Strikeout.'};
 const common={schemaVersion:'1',service:'reverse_image',checkedAt:new Date().toISOString(),limitations:['Visual similarity does not establish identity, ownership, location or when an image was taken.','No face identification, people tracking, private-account access or automatic downloads. Search coverage is provider-dependent.']};
 if(mode==='handoff'||(mode==='auto'&&!env.SERPAPI_API_KEY)){
  consent(body,'google_lens');return {...common,status:'requires_user_search',mode:'handoff',findings:[],checks:[{provider:'serpapi',status:env.SERPAPI_API_KEY?'not_selected':'not_configured'}],handoff,coverage:'Search has not run. Open Google Lens and review its results there.'};
 }
 if(!env.SERPAPI_API_KEY)fail(503,'Automatic image results require SERPAPI_API_KEY. Use the explicitly consented Google Lens handoff without a key.');
 consent(body,'serpapi');
 let data;
 try{data=await serpSearch({engine:'google_lens',url:url.href,type:'all'},{env,fetcher})}
 catch(e){if(mode==='auto'&&body.consent.providers.includes('google_lens'))return {...common,status:'requires_user_search',mode:'handoff',findings:[],checks:[{provider:'serpapi_google_lens',status:'provider_error'}],handoff,coverage:'Automatic search failed. No results were inferred; Google Lens is available for a separate user-initiated search.'};throw e}
 const exact=Array.isArray(data.exact_matches)?data.exact_matches:[];
 const visual=Array.isArray(data.visual_matches)?data.visual_matches:[];
 const organic=Array.isArray(data.organic_results)?data.organic_results:[];
 if(![data.exact_matches,data.visual_matches,data.organic_results].some(Array.isArray))
  return {...common,status:'incomplete',mode:'api',findings:[],checks:[{provider:'serpapi_google_lens',status:'unrecognized_response'}],coverage:'The provider returned no supported result sections. This is not evidence of zero matches.'};
 const seen=new Set(),findings=[];
 let visualAccepted=0,webAccepted=0;
 function add(row,confidence,kind){
  if(!row||typeof row!=='object'||(kind==='visual'?visualAccepted>=20:webAccepted>=10))return;
  const source=resultURL(row.link);if(!source||seen.has(source))return;
  seen.add(source);
  findings.push({category:'image_reference',url:source,title:redactEvidence(row.title||'Image reference'),provider:'serpapi_google_lens',confidence,reviewPriority:'review'});
  if(kind==='visual')visualAccepted++;else webAccepted++;
 }
 for(const row of exact)add(row,'provider_exact_match','visual');
 for(const row of visual)add(row,row?.exact_matches===true?'provider_exact_match':'provider_visual_similarity','visual');
 for(const row of organic)add(row,'provider_web_result','web');
 return {...common,status:'completed',mode:'api',findings,checks:[{provider:'serpapi_google_lens',status:'completed',matches:findings.length,visualMatches:visualAccepted,webResults:webAccepted}],coverage:'Up to 20 deduplicated exact/visual links and 10 web-result links in this Google Lens response. Source pages/images were not fetched or independently verified.'};
}
