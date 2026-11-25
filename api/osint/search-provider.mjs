import {fail} from './image-url.mjs';
// Fixed provider host; URL/key never appears in logs or returned errors.
export async function serpSearch(parameters,{env=process.env,fetcher=fetch}={}){
 if(!env.SERPAPI_API_KEY)fail(503,'SERPAPI_API_KEY is not configured. Use the free Google handoff.');
 const endpoint=new URL('https://serpapi.com/search.json');endpoint.search=new URLSearchParams({...parameters,api_key:env.SERPAPI_API_KEY});
 try{
  const response=await fetcher(endpoint,{redirect:'error',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
  if(!response.ok)fail(502,'Search provider returned HTTP '+response.status+'. Check quota/configuration.');
  const reader=response.body?.getReader();if(!reader)fail(502,'Search provider returned no response body.');
  let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();fail(502,'Search response exceeded its size limit.')}chunks.push(value)}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  // Only documented/observed successful-empty responses are normalized.
  // https://serpapi.com/api-status-and-error-codes
  const emptyMessage = { google: "Google hasn't returned any results for this query.",
    duckduckgo: "DuckDuckGo hasn't returned any results for this query." }[parameters.engine];
  const successfulEmpty = !!emptyMessage &&
    data.search_metadata?.status === 'Success' &&
    data.search_information?.organic_results_state === 'Fully empty' &&
    (data.organic_results === undefined || (Array.isArray(data.organic_results) && data.organic_results.length === 0)) &&
    data.error === emptyMessage;
  if((data.error&&!successfulEmpty)||data.search_metadata?.status!=='Success')fail(502,'Search provider did not complete this check.');
  if(!successfulEmpty)return data;
  const normalized={...data,organic_results:[]};
  delete normalized.error;
  return normalized;
 }catch(e){if(e.status)throw e;fail(502,'Search provider could not be reached or returned unreadable data. No result was invented.')}
}
