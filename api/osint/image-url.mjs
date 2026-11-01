import {lookup} from 'node:dns/promises';
import {isIP, BlockList} from 'node:net';
export const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
export function consent(body,provider){
 if(body?.consent?.selfOwned!==true||body.consent.version!=='1')fail(400,'Confirm this is your own information or an authorized self-audit.');
 if(body.consent.providers!==undefined&&(!Array.isArray(body.consent.providers)||body.consent.providers.some(x=>typeof x!=='string')))fail(400,'Provider consent must be a list.');
 if(provider&&!body.consent.providers?.includes(provider))fail(400,'Approve disclosure to '+provider+' for this request.');
}
export function publicURL(value){
 if(typeof value!=='string'||value.length>2000)fail(400,'Provide a public HTTPS URL.');
 let u;try{u=new URL(value)}catch{fail(400,'Provide a public HTTPS URL.')}
 const host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||isIP(host.replace(/^\[|\]$/g,''))||!host.includes('.')||/(?:^|\.)(localhost|local|internal|lan|home|onion|test|invalid)$/.test(host))fail(400,'Only public HTTPS hostnames on port 443 without credentials are supported.');
 if([...u.searchParams.keys()].some(k=>/(?:token|secret|password|signature|credential|session|api.?key|authorization|^code$|^auth$|^sig$|^key$|^access.?key|x-amz|x-goog|^jwt$|^policy$)/i.test(k)))fail(400,'Remove private access tokens or signed-link parameters from the URL.');
 u.hash='';return u;
}
const deny=new BlockList();
for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])deny.addSubnet(ip,bits,'ipv4');
const v6=new BlockList();v6.addSubnet('2000::',3,'ipv6');
const deny6=new BlockList();for(const [ip,bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])deny6.addSubnet(ip,bits,'ipv6');
export function publicAddress(address){const version=isIP(address);return version===4?!deny.check(address,'ipv4'):version===6&&v6.check(address,'ipv6')&&!deny6.check(address,'ipv6')}
export async function resolvePublic(value,{resolver=lookup}={}){
 const url=publicURL(value);let entries,timer;
 try{entries=await Promise.race([resolver(url.hostname,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS timeout')),5000)})]);}catch{fail(502,'Public hostname resolution failed.')}finally{clearTimeout(timer)}
 if(!Array.isArray(entries)||!entries.length||entries.some(x=>!publicAddress(x.address)))fail(400,'The hostname must resolve exclusively to public internet addresses.');
 return {url,address:entries[0].address,family:isIP(entries[0].address)};
}
