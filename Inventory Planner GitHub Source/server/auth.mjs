// Team sign-in: Microsoft Entra ID (Microsoft 365) OpenID Connect, authorization-code flow with PKCE,
// plus a server-side approved-user allowlist that is re-checked on every request.
import {createHmac,createHash,createPublicKey,randomBytes,timingSafeEqual,verify} from 'node:crypto';

const SESSION_HOURS=12,LOGIN_MINUTES=10;
export const SESSION_COOKIE='__Host-planner_session',LOGIN_COOKIE='__Host-planner_login';

export function authSettings(env=process.env){
 const s={tenantId:env.ENTRA_TENANT_ID?.trim(),clientId:env.ENTRA_CLIENT_ID?.trim(),clientSecret:env.ENTRA_CLIENT_SECRET,sessionSecret:env.SESSION_SECRET,
  approved:new Set((env.APPROVED_USERS||'').split(/[,;\s]+/).map(e=>e.trim().toLowerCase()).filter(Boolean)),origin:env.APP_ORIGIN};
 const missing=[['ENTRA_TENANT_ID',s.tenantId],['ENTRA_CLIENT_ID',s.clientId],['ENTRA_CLIENT_SECRET',s.clientSecret],['SESSION_SECRET',s.sessionSecret],['APPROVED_USERS',s.approved.size],['APP_ORIGIN',s.origin]].filter(([,v])=>!v).map(([k])=>k);
 if(s.sessionSecret&&s.sessionSecret.length<32)missing.push('SESSION_SECRET (at least 32 characters)');
 if(s.tenantId&&['common','organizations','consumers'].includes(s.tenantId.toLowerCase()))missing.push('ENTRA_TENANT_ID (must be the Loftwall tenant ID, not '+s.tenantId+')');
 if(s.origin&&!/^https:\/\/[^/]+$/.test(s.origin))missing.push('APP_ORIGIN (must be https://host with no trailing slash)');
 return {...s,missing,configured:missing.length===0};
}

const b64u=b=>Buffer.from(b).toString('base64url');
const hmac=(secret,v)=>createHmac('sha256',secret).update(v).digest('base64url');
const same=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};

export function seal(secret,payload){const body=b64u(JSON.stringify(payload));return body+'.'+hmac(secret,body)}
export function unseal(secret,value,now=Date.now()){
 if(!value)return null;const [body,mac,extra]=value.split('.');if(extra!==undefined||!body||!mac||!same(mac,hmac(secret,body)))return null;
 try{const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return typeof p.exp==='number'&&p.exp>now?p:null}catch{return null}
}

export function readCookie(req,name){
 for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()}
 return null;
}
const cookie=(name,value,maxAge)=>`${name}=${value}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;

// Returns the signed-in, still-approved user, or null.
export function currentUser(s,req,now=Date.now()){
 const p=unseal(s.sessionSecret,readCookie(req,SESSION_COOKIE),now);
 return p&&p.kind==='session'&&s.approved.has(p.email)?p:null;
}
export const csrfFor=(s,user)=>hmac(s.sessionSecret,'csrf:'+user.sid);

const authority=s=>`https://login.microsoftonline.com/${encodeURIComponent(s.tenantId)}`;
const redirectUri=s=>s.origin+'/auth/callback';

export function beginLogin(s,now=Date.now()){
 const state=b64u(randomBytes(24)),nonce=b64u(randomBytes(24)),verifier=b64u(randomBytes(32));
 const q=new URLSearchParams({client_id:s.clientId,response_type:'code',redirect_uri:redirectUri(s),response_mode:'query',scope:'openid profile email',state,nonce,
  code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
 return {location:`${authority(s)}/oauth2/v2.0/authorize?${q}`,setCookie:cookie(LOGIN_COOKIE,seal(s.sessionSecret,{kind:'login',state,nonce,verifier,exp:now+LOGIN_MINUTES*60e3}),LOGIN_MINUTES*60)};
}

let jwksCache={at:0,keys:[]};
async function signingKey(s,kid,fetcher){
 const find=()=>jwksCache.keys.find(k=>k.kid===kid);
 if(!find()||Date.now()-jwksCache.at>6*3600e3){
  const r=await fetcher(`${authority(s)}/discovery/v2.0/keys`);if(!r.ok)throw new Error('Could not load Microsoft signing keys');
  jwksCache={at:Date.now(),keys:(await r.json()).keys||[]};
 }
 const jwk=find();if(!jwk)throw new Error('Unknown Microsoft signing key');return createPublicKey({key:jwk,format:'jwk'});
}

export async function verifyIdToken(s,token,nonce,{keyFor=kid=>signingKey(s,kid,fetch),now=Date.now()}={}){
 const [h,p,sig,extra]=String(token).split('.');if(!h||!p||!sig||extra!==undefined)throw new Error('Malformed sign-in token');
 const header=JSON.parse(Buffer.from(h,'base64url').toString('utf8')),claims=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
 if(header.alg!=='RS256')throw new Error('Unexpected sign-in token algorithm');
 if(!verify('RSA-SHA256',Buffer.from(h+'.'+p),await keyFor(header.kid),Buffer.from(sig,'base64url')))throw new Error('Invalid sign-in token signature');
 const sec=now/1000;
 if(claims.iss!==`https://login.microsoftonline.com/${s.tenantId}/v2.0`||claims.tid!==s.tenantId)throw new Error('Sign-in came from another organization');
 if(claims.aud!==s.clientId)throw new Error('Sign-in token was issued to another app');
 if(!(claims.exp>sec-60)||(claims.nbf&&claims.nbf>sec+60))throw new Error('Sign-in token expired');
 if(!nonce||claims.nonce!==nonce)throw new Error('Sign-in token does not match this sign-in');
 const email=String(claims.email||claims.preferred_username||'').toLowerCase();if(!email)throw new Error('Microsoft did not return an email address');
 return {email,name:claims.name||email};
}

// Handles /auth/callback. Returns {setCookies, user} on success; throws with a user-safe message otherwise.
export async function finishLogin(s,req,url,{fetcher=fetch,now=Date.now(),keyFor}={}){
 const login=unseal(s.sessionSecret,readCookie(req,LOGIN_COOKIE),now);
 if(url.searchParams.get('error'))throw new Error('Microsoft sign-in was cancelled or refused');
 if(!login||login.kind!=='login'||!same(url.searchParams.get('state')||'',login.state))throw new Error('Sign-in expired. Please try again.');
 const r=await fetcher(`${authority(s)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:s.clientId,client_secret:s.clientSecret,grant_type:'authorization_code',code:url.searchParams.get('code')||'',redirect_uri:redirectUri(s),code_verifier:login.verifier})});
 const tokens=await r.json().catch(()=>({}));if(!r.ok||!tokens.id_token)throw new Error('Microsoft sign-in could not be completed');
 const who=await verifyIdToken(s,tokens.id_token,login.nonce,{keyFor:keyFor||(kid=>signingKey(s,kid,fetcher)),now});
 const clear=cookie(LOGIN_COOKIE,'',0);
 if(!s.approved.has(who.email))return {setCookies:[clear],user:null,email:who.email};
 const user={kind:'session',email:who.email,name:who.name,sid:b64u(randomBytes(16)),exp:now+SESSION_HOURS*3600e3};
 return {setCookies:[clear,cookie(SESSION_COOKIE,seal(s.sessionSecret,user),SESSION_HOURS*3600)],user};
}
export const signOutCookie=()=>cookie(SESSION_COOKIE,'',0);
