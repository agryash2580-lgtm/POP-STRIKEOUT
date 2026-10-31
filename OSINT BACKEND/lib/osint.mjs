import {parsePhoneNumberFromString} from 'libphonenumber-js';
import {webSearch,emailBreaches,passwordRange} from './providers.mjs';
const invalid=message=>Object.assign(Error(message),{status:400});
function exact(value,max=100){if(typeof value!=='string'||!value.trim()||value.length>max||/[\r\n"<>:]/.test(value))throw invalid('Invalid identifier.');return '"'+value.trim()+'"'}
function personalName(value){exact(value,80);if(!/^[\p{L}\p{N} .'-]+$/u.test(value))throw invalid('Enter your own name without search operators.');return value.trim()}
function ownedConsent(body){if(body?.consent?.selfOwned!==true||body.consent.version!=='1')throw invalid('Explicit self-owned-information consent version 1 is required.');}
function permitted(body,provider){if(!Array.isArray(body.consent.providers)||!body.consent.providers.includes(provider))throw invalid('Approve disclosure to '+provider+' for this check.');}
export function cardReview(number){
 if(typeof number!=='string'||!/^[0-9 -]{12,25}$/.test(number))throw invalid('Provide a payment card number containing only digits/spaces/hyphens.');
 const digits=number.replace(/[ -]/g,'');if(!/^\d{12,19}$/.test(digits))throw invalid('Invalid payment-card length.');
 let sum=0;for(let i=digits.length-1,alternate=false;i>=0;i--,alternate=!alternate){let n=Number(digits[i]);if(alternate){n*=2;if(n>9)n-=9}sum+=n}
 return {masked:'•••• '+digits.slice(-4),length:digits.length,luhnValid:sum%10===0,externalLookup:false,limitations:'A checksum does not establish issuance, validity, ownership, or absence from breaches. No card database was queried.'};
}
export async function runCheck(body,options={}){
 ownedConsent(body);const {service,input={}}=body;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(body).some(k=>!['service','input','consent'].includes(k)))throw invalid('Unsupported request fields.');
 if(!['linkedin','email','phone','identity_cards','payment_cards'].includes(service))throw invalid('Unsupported service. Saved passwords use the prefix-only endpoint or local audit CLI.');
 const fields={linkedin:['profileUrl','fullName'],email:['email'],phone:['phone'],identity_cards:['fullName','employer'],payment_cards:['number']}[service];
 if(Object.keys(input).some(k=>!fields.includes(k)))throw invalid('Unsupported input fields. Never send passwords or card security codes.');
 if('password' in input||'cvv' in input||'securityCode' in input)throw invalid('Passwords and card security codes are not accepted.');
 const report={schemaVersion:'1',service,checkedAt:new Date().toISOString(),status:'completed',findings:[],checks:[],limitations:['Results are leads for your review, not verified identity matches or proof of safety. No result pages are fetched.']};
 if(service==='payment_cards'){report.checks.push({provider:'local',status:'completed',result:cardReview(input.number)});return report;}
 let queries=[];
 if(service==='email'){
  if(typeof input.email!=='string'||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(input.email)||input.email.length>254)throw invalid('Enter a valid email address.');
  const email=input.email;
  queries=[exact(email,254)];
  if(body.consent.providers?.includes('hibp')){try{const rows=await emailBreaches(email,options);report.checks.push({provider:'hibp',status:'completed',matches:rows.length});report.findings.push(...rows.map(x=>({category:'breach_membership',reviewPriority:'high',confidence:'provider_record',...x})));}catch(e){report.checks.push({provider:'hibp',status:e.code||'provider_error'});}}
 }
 if(service==='phone'){
  if(typeof input.phone!=='string'||! /^\+[1-9]\d{6,14}$/.test(input.phone))throw invalid('Use an international E.164 number, such as +12025550123.');
  const phone=parsePhoneNumberFromString(input.phone);if(!phone?.isPossible())throw invalid('Phone number is not a possible international number.');
  report.checks.push({provider:'local',status:'completed',result:{country:phone.country||null,internationalFormat:phone.formatInternational(),identityVerified:false}});
  queries=[exact(phone.number),exact(phone.formatInternational())];
 }
 if(service==='linkedin'){
  let url;try{url=new URL(input.profileUrl)}catch{throw invalid('Provide your LinkedIn /in/ profile URL.');}
  if(url.protocol!=='https:'||!['linkedin.com','www.linkedin.com'].includes(url.hostname)||!/^\/in\/[a-zA-Z0-9_%.-]+\/?$/.test(url.pathname)||url.username||url.password||url.port)throw invalid('Only personal LinkedIn /in/ profile URLs are supported.');
  queries=['"https://www.linkedin.com'+url.pathname.replace(/\/$/,'')+'"'];
  if(input.fullName)queries.push(exact(personalName(input.fullName))+' (filetype:pdf OR filetype:docx)');
  report.limitations.push('Public search references only. No LinkedIn login, private profile access, employment verification or site scraping.');
 }
 if(service==='identity_cards'){
  const name=personalName(input.fullName);queries=[exact(name)+' ("employee badge" OR "ID card" OR "identity card")'];
  if(input.employer){const employer=personalName(input.employer);queries.push(exact(name)+' '+exact(employer)+' filetype:pdf');}
  report.limitations.push('Does not retrieve documents, run face recognition, or establish that an identity document belongs to you.');
 }
 if(body.consent.providers?.includes('brave')){
  for(const query of [...new Set(queries)].slice(0,2)){
   try{const rows=await webSearch(query,options);report.checks.push({provider:'brave',status:'completed',matches:rows.length});report.findings.push(...rows.map(x=>({category:service==='identity_cards'?'possible_identity_document':'public_reference',reviewPriority:service==='identity_cards'?'high':'review',confidence:'unverified_search_lead',...x})));}
   catch(e){report.checks.push({provider:'brave',status:e.code||'provider_error'});break;}
  }
 }
 if(!report.checks.some(x=>x.provider!=='local'))throw invalid('Select an approved lookup provider: brave for public search, or hibp for email breaches.');
 const seen=new Set();report.findings=report.findings.filter(x=>{const key=x.url||x.name;if(seen.has(key))return false;seen.add(key);return true});
 if(report.checks.some(x=>x.status!=='completed'))report.status='incomplete';
 return report;
}
export async function runPasswordRange(body,options={}){
 ownedConsent(body);permitted(body,'pwned_passwords');
 if(Object.keys(body).some(k=>!['prefix','consent'].includes(k)))throw invalid('Only a five-character hash prefix and consent may be submitted.');
 return {prefix:body.prefix,range:await passwordRange(body.prefix,options),matching:'Compare the remaining 35 SHA-1 characters locally. Do not upload the full hash or password.'};
}
