export function connection(){
 const privateKeyPem=process.env.NETSUITE_PRIVATE_KEY_PEM?.replaceAll('\\n','\n');
 const c={baseUrl:'https://3646375.suitetalk.api.netsuite.com',accountId:'3646375',clientId:process.env.NETSUITE_CLIENT_ID,certificateId:process.env.NETSUITE_CERTIFICATE_ID,privateKeyPem,settingsSearchId:'customsearch5042',settingsMode:'Saved search customsearch5042'};
 if(!c.clientId||!c.certificateId||!c.privateKeyPem)throw new Error('Add the NetSuite credentials (NETSUITE_CLIENT_ID, NETSUITE_CERTIFICATE_ID, NETSUITE_PRIVATE_KEY_PEM) in Secrets.');return c;
}
