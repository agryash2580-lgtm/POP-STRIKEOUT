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
  if(data.error||data.search_metadata?.status!=='Success')fail(502,'Search provider did not complete this check.');
  return data;
 }catch(e){if(e.status)throw e;fail(502,'Search provider could not be reached or returned unreadable data. No result was invented.')}
}
