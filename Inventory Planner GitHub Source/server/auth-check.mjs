import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import {authSettings,seal,unseal,currentUser,csrfFor,beginLogin,finishLogin,verifyIdToken,SESSION_COOKIE,LOGIN_COOKIE} from './auth.mjs';

const tenant='11111111-2222-3333-4444-555555555555',env={ENTRA_TENANT_ID:tenant,ENTRA_CLIENT_ID:'app-1',ENTRA_CLIENT_SECRET:'shh',SESSION_SECRET:'x'.repeat(40),APPROVED_USERS:'Sean@Loftwall.com, ops@loftwall.com',APP_ORIGIN:'https://planner.example.dev'};
const s=authSettings(env);assert.equal(s.configured,true);assert.deepEqual([...s.approved],['sean@loftwall.com','ops@loftwall.com']);
assert.equal(authSettings({}).configured,false);assert.equal(authSettings({...env,ENTRA_TENANT_ID:'common'}).configured,false);
assert.equal(authSettings({...env,SESSION_SECRET:'short'}).configured,false);assert.equal(authSettings({...env,APP_ORIGIN:'http://planner.example.dev'}).configured,false);

const now=Date.now(),cookieReq=v=>({headers:{cookie:`other=1; ${SESSION_COOKIE}=${v}`}});
const good=seal(s.sessionSecret,{kind:'session',email:'sean@loftwall.com',sid:'a',exp:now+1e6});
assert.equal(currentUser(s,cookieReq(good)).email,'sean@loftwall.com');
assert.equal(currentUser(s,cookieReq(good.slice(0,-2)+'AA')),null,'tampered');
assert.equal(currentUser(s,cookieReq(seal('y'.repeat(40),{kind:'session',email:'sean@loftwall.com',sid:'a',exp:now+1e6}))),null,'other secret');
assert.equal(currentUser(s,cookieReq(seal(s.sessionSecret,{kind:'session',email:'sean@loftwall.com',sid:'a',exp:now-1}))),null,'expired');
assert.equal(currentUser(s,cookieReq(seal(s.sessionSecret,{kind:'session',email:'former@loftwall.com',sid:'a',exp:now+1e6}))),null,'removed from allowlist');
assert.equal(currentUser(s,cookieReq(seal(s.sessionSecret,{kind:'login',email:'sean@loftwall.com',sid:'a',exp:now+1e6}))),null,'login cookie is not a session');
assert.notEqual(csrfFor(s,{sid:'a'}),csrfFor(s,{sid:'b'}));assert.equal(unseal(s.sessionSecret,'garbage'),null);

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),keyFor=async()=>publicKey;
const token=(claims,key=privateKey)=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'k'})).toString('base64url'),p=Buffer.from(JSON.stringify(claims)).toString('base64url');return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key).toString('base64url')};
const claims=(o={})=>({iss:`https://login.microsoftonline.com/${tenant}/v2.0`,tid:tenant,aud:'app-1',exp:now/1000+600,nonce:'n1',preferred_username:'Sean@Loftwall.com',name:'Sean',...o});
assert.equal((await verifyIdToken(s,token(claims()),'n1',{keyFor})).email,'sean@loftwall.com');
const rejects=async(c,msg,key)=>assert.rejects(verifyIdToken(s,token(c,key),'n1',{keyFor}),msg);
await rejects(claims({tid:'other',iss:'https://login.microsoftonline.com/other/v2.0'}),/another organization/);
await rejects(claims({aud:'app-2'}),/another app/);await rejects(claims({exp:now/1000-120}),/expired/);await rejects(claims({nonce:'n2'}),/does not match/);
await rejects(claims(),/signature/,generateKeyPairSync('rsa',{modulusLength:2048}).privateKey);

// Full callback: state must match, approved users get a session, others do not.
const start=beginLogin(s,now),loginValue=start.setCookie.split(';')[0].split('=').slice(1).join('='),login=unseal(s.sessionSecret,loginValue);
assert.match(start.location,/^https:\/\/login\.microsoftonline\.com\/11111111-.*code_challenge_method=S256/);assert.match(start.setCookie,/Secure; HttpOnly; SameSite=Lax/);
const req={headers:{cookie:`${LOGIN_COOKIE}=${loginValue}`}},cb=st=>new URL(`https://planner.example.dev/auth/callback?code=c&state=${st}`);
const tokenFetch=user=>async(u,o)=>{assert.equal(new URLSearchParams(o.body).get('code_verifier'),login.verifier);return {ok:true,json:async()=>({id_token:token(claims({nonce:login.nonce,preferred_username:user}))})}};
const ok=await finishLogin(s,req,cb(login.state),{fetcher:tokenFetch('ops@loftwall.com'),keyFor,now});
assert.equal(ok.user.email,'ops@loftwall.com');assert.ok(ok.setCookies.some(c=>c.startsWith(SESSION_COOKIE+'=')));
const no=await finishLogin(s,req,cb(login.state),{fetcher:tokenFetch('guest@loftwall.com'),keyFor,now});
assert.equal(no.user,null);assert.ok(!no.setCookies.some(c=>c.startsWith(SESSION_COOKIE+'=')));
await assert.rejects(finishLogin(s,req,cb('wrong'),{fetcher:tokenFetch('ops@loftwall.com'),keyFor,now}),/expired/);
await assert.rejects(finishLogin(s,{headers:{}},cb(login.state),{fetcher:tokenFetch('ops@loftwall.com'),keyFor,now}),/expired/);
console.log('Passed: sign-in settings, signed/expiring sessions, allowlist re-check, Microsoft token checks (tenant, app, expiry, nonce, signature), PKCE callback and unapproved users.');
