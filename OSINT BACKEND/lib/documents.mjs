import {luhn,redactEvidence} from './redact.mjs';
const invalid=message=>Object.assign(Error(message),{status:400});
function safeUrl(value){if(!value)return null;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;return u.origin+u.pathname}catch{return null}}
export function reviewDocuments(body){
 if(body?.consent?.selfOwned!==true||body.consent.version!=='1')throw invalid('Confirm these are your own documents and identifiers.');
 if(!Array.isArray(body.documents)||!body.documents.length||body.documents.length>3)throw invalid('Provide one to three text documents.');
 const subjects=body.identifiers||{};
 for(const [type,values] of Object.entries(subjects)){
  if(!['emails','phones','linkedinProfiles','names'].includes(type)||!Array.isArray(values)||values.length>10||values.some(x=>typeof x!=='string'||x.length<3||x.length>254))throw invalid('Invalid identifier list.');
 }
 const report={schemaVersion:'1',kind:'supplied_content_review',service:'documents',status:'completed',checkedAt:new Date().toISOString(),coverage:'Only the supplied document text. No external requests, crawling, OCR or whole-web search.',documentsReviewed:body.documents.length,findings:[],limitations:['Source URLs are supplied labels, not fetched or independently verified.','Detected secret/card/identity patterns require review; examples and test values may be intentional.','No findings is not proof of safety.']};
 body.documents.forEach((doc,index)=>{
  if(!doc||typeof doc.text!=='string'||!doc.text.trim()||doc.text.length>100000)throw invalid('Each document needs 1–100,000 characters of text.');
  const text=doc.text,lower=text.toLowerCase(),source=safeUrl(doc.sourceUrl);
  function add(category,position,evidence,priority='review',extra={}){
   report.findings.push({id:'F'+String(report.findings.length+1).padStart(4,'0'),document:index+1,line:text.slice(0,position).split('\n').length,source,sourceVerification:source?'provided_url_not_fetched':'local_supplied_document',category,reviewPriority:priority,evidence:redactEvidence(evidence),...extra});
  }
  for(const email of subjects.emails||[]){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw invalid('Invalid supplied email identifier.');
   const at=lower.indexOf(email.toLowerCase());if(at>=0)add('email_occurrence',at,text.slice(Math.max(0,at-50),at+email.length+60),'review',{confidence:'exact_occurrence_in_supplied_text'});
  }
  for(const profile of subjects.linkedinProfiles||[]){
   let url;try{url=new URL(profile)}catch{throw invalid('Invalid LinkedIn URL.');}
   if(!['linkedin.com','www.linkedin.com'].includes(url.hostname)||!url.pathname.startsWith('/in/'))throw invalid('Invalid LinkedIn profile URL.');
   const needle=url.pathname.replace(/\/$/,'').toLowerCase(),at=lower.indexOf(needle);if(at>=0)add('linkedin_reference',at,text.slice(Math.max(0,at-50),at+needle.length+60),'review',{confidence:'profile_path_occurrence_in_supplied_text'});
  }
  for(const phone of subjects.phones||[]){
   if(!/^\+[1-9]\d{6,14}$/.test(phone))throw invalid('Phone identifiers must use E.164 format.');
   const pattern=new RegExp('(?<!\\d)\\+?'+phone.slice(1).split('').join('[\\s().-]*')+'(?!\\d)'),match=pattern.exec(text);
   if(match)add('phone_occurrence',match.index,text.slice(Math.max(0,match.index-50),match.index+match[0].length+60),'review',{confidence:'formatted_number_occurrence_in_supplied_text'});
  }
  for(const match of text.matchAll(/(?:\d[ -]?){12,19}/g)){
   const digits=match[0].replace(/\D/g,'');if(luhn(digits))add('payment_card_exposure',match.index,'Payment-card-like number ending '+digits.slice(-4),'high',{masked:'•••• '+digits.slice(-4),confidence:'checksum_valid_pattern_not_verified_card'});
  }
  for(const match of text.matchAll(/\b(password|passwd|pwd|api[_ -]?key|secret|access[_ -]?token)\s*[=:]\s*["']?([^\s"'<>;,]{4,})/gi)){
   if(['null','true','false','none','undefined','[redacted]'].includes(match[2].toLowerCase()))continue;
   add('credential_like_assignment',match.index,match[1]+' = [REDACTED]','high',{confidence:'pattern_match_not_validated',secretValueIncluded:false});
  }
  for(const name of subjects.names||[]){
   const at=lower.indexOf(name.toLowerCase());if(at<0)continue;
   const area=text.slice(Math.max(0,at-200),at+name.length+300);
   if(/\b(id card|identity card|employee badge|aadhaar|aadhar|passport|social security)\b/i.test(area))add('possible_identity_document',at,area,'high',{confidence:'own_name_and_document_terms_cooccur_not_identity_verification'});
  }
 });
 return report;
}
