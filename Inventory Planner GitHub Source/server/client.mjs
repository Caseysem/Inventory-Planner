import {readFile} from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';

// Only authentication and read-only SuiteQL are exposed. No record writes.
export class NetSuiteReader {
 constructor(config){
  if(config.baseUrl!=='https://3646375.suitetalk.api.netsuite.com')throw new Error('Unexpected NetSuite destination');
  this.config=config;this.token=null;this.expires=0;
 }
 async authenticate(){
  if(this.token&&Date.now()<this.expires)return;
  const c=this.config,endpoint=c.baseUrl+'/services/rest/auth/oauth2/v1/token';
  const now=Math.floor(Date.now()/1000),encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const input=encode({typ:'JWT',alg:'ES256',kid:c.certificateId})+'.'+encode({iss:c.clientId,scope:c.settingsUrl?['rest_webservices','restlets']:['rest_webservices'],aud:endpoint,iat:now,exp:now+300});
  const key=createPrivateKey(c.privateKeyPem||await readFile(c.privateKeyPath));
  const signature=sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const body=new URLSearchParams({grant_type:'client_credentials',client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',client_assertion:input+'.'+signature});
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,redirect:'error',signal:AbortSignal.timeout(30000)});
  const data=await r.json();
  if(!r.ok||!data.access_token)throw new Error('Authentication failed (HTTP '+r.status+'): '+(data.error||'no access token')+(data.error_description?' — '+data.error_description:''));
  this.token=data.access_token;this.expires=Date.now()+(Number(data.expires_in)-60)*1000;
 }
 async query(q,{limit=1000,offset=0}={}){
  if(!/^\s*SELECT\b/i.test(q)||/;|\b(INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER|TRUNCATE)\b/i.test(q))throw new Error('Only a single SELECT query is permitted');
  if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isInteger(offset)||offset<0)throw new Error('Invalid pagination');
  await this.authenticate();
  const r=await fetch(this.config.baseUrl+'/services/rest/query/v1/suiteql?limit='+limit+'&offset='+offset,{method:'POST',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json',Prefer:'transient'},body:JSON.stringify({q}),redirect:'error',signal:AbortSignal.timeout(60000)});
  const data=await r.json();
  if(!r.ok){const descriptions=(data['o:errorDetails']||[]).map(e=>e.detail||e['o:errorCode']).join('; ');throw new Error('Read query failed (HTTP '+r.status+'): '+descriptions);}
  return data;
 }
 async readRecord(path,accept='application/json'){
  if(!/^(?:inventoryItem\/[0-9]+(?:\/locations)?(?:\?expandSubResources=true)?|metadata-catalog(?:\/inventoryitem)?\/?(?:\?select=inventoryItem)?)$/.test(path))throw new Error('Unsupported read endpoint');
  await this.authenticate();
  const r=await fetch(this.config.baseUrl+'/services/rest/record/v1/'+path,{headers:{Authorization:'Bearer '+this.token,Accept:accept},redirect:'error',signal:AbortSignal.timeout(60000)});
  const data=await r.json();
  if(!r.ok)throw new Error('Record read failed (HTTP '+r.status+'): '+(data['o:errorDetails']||[]).map(e=>e.detail).join('; '));
  return data;
 }
 async readSavedSearch(id=null,{limit=1000,offset=0}={}){
  if(id!==null&&!/^(?:[0-9]+|customsearch[a-zA-Z0-9_]+)$/.test(String(id)))throw new Error('Invalid saved search ID');
  if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isInteger(offset)||offset<0)throw new Error('Invalid pagination');
  await this.authenticate();
  const path='/services/rest/query/v1/savedsearch'+(id===null?'':'/'+encodeURIComponent(id)+'/result');
  const r=await fetch(this.config.baseUrl+path+'?limit='+limit+'&offset='+offset,{method:'GET',headers:{Authorization:'Bearer '+this.token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});
  const data=await r.json();
  if(!r.ok)throw new Error('Saved search read failed (HTTP '+r.status+'): '+(data['o:errorDetails']||[]).map(e=>e.detail||e['o:errorCode']).join('; '));
  return data;
 }
 async readSettings(page=0){
  const url=new URL(this.config.settingsUrl);
  if(url.origin!=='https://3646375.restlets.api.netsuite.com'||url.pathname!=='/app/site/hosting/restlet.nl'||!url.searchParams.get('script')||!url.searchParams.get('deploy'))throw new Error('Invalid settings endpoint');
  if(!Number.isInteger(page)||page<0)throw new Error('Invalid settings page');
  for(const key of [...url.searchParams.keys()])if(!['script','deploy'].includes(key))url.searchParams.delete(key);
  url.searchParams.set('page',String(page));await this.authenticate();
  const r=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});
  const data=await r.json();if(!r.ok)throw new Error('Read-only settings adapter failed (HTTP '+r.status+'): '+(data.error?.message||'check its role audience and RESTlets scope'));return data;
 }
}
