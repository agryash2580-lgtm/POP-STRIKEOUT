export function handle(value) {
 const h=String(value||'').trim().replace(/^@/,'').toLowerCase();
 if(!/^[a-z0-9._]{1,30}$/.test(h)||h.includes('..')||h.endsWith('.'))throw Error('Enter a username, without a URL.');
 return h;
}
export function prepare(owner,service,consent){
 owner=handle(owner);service=handle(service);
 if(consent!==true||owner===service)throw Error('Consent and two distinct accounts are required.');
 const at=new Date().toISOString();
 return {owner,service,status:'prepared',consentAt:at,events:[{at,text:'Owner consent recorded; request not sent.'}]};
}
export function advance(record,action){
 const allowed={prepared:['sent','revoked'],sent:['accepted','declined','revoked'],accepted:['revoked'],declined:['revoked']};
 if(!allowed[record.status]?.includes(action))throw Error('Action unavailable at this stage.');
 const at=new Date().toISOString();
 const text={sent:'Operator reports request sent in Instagram.',accepted:'Owner reports request accepted. No content imported.',declined:'Owner reports request declined.',revoked:'Consent revoked. Instagram removal/cancellation requires manual action.'}[action];
 return {...record,status:action,...(action==='revoked'?{revokedAt:at}:{}),events:[...record.events,{at,text}]};
}
