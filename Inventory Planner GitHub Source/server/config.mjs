// Rebuilds a PEM whose line breaks were lost when pasted into a secrets field (spaces or literal \n instead of newlines).
export function normalizePem(raw){
 if(!raw)return raw;
 const s=raw.trim().replace(/^["']|["']$/g,'').replaceAll('\\n','\n').replace(/\r/g,'');
 const m=s.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
 if(!m)return /^[A-Za-z0-9+/=\s]+$/.test(s)&&s.replace(/\s+/g,'').length>64?pem('PRIVATE KEY',s):s;
 return pem(m[1],m[2]);
}
const pem=(label,body)=>`-----BEGIN ${label}-----\n${body.replace(/\s+/g,'').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;

export function connection(){
 const privateKeyPem=normalizePem(process.env.NETSUITE_PRIVATE_KEY_PEM);
 const c={baseUrl:'https://3646375.suitetalk.api.netsuite.com',accountId:'3646375',clientId:process.env.NETSUITE_CLIENT_ID?.trim(),certificateId:process.env.NETSUITE_CERTIFICATE_ID?.trim(),privateKeyPem,settingsSearchId:'customsearch5042',settingsMode:'Saved search customsearch5042'};
 if(!c.clientId||!c.certificateId||!c.privateKeyPem)throw new Error('Add the NetSuite credentials (NETSUITE_CLIENT_ID, NETSUITE_CERTIFICATE_ID, NETSUITE_PRIVATE_KEY_PEM) in Secrets.');return c;
}
