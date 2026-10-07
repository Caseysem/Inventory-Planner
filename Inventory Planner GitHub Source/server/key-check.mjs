// Checks the NetSuite secrets without printing their values. Run: node server/key-check.mjs
import {createPrivateKey} from 'node:crypto';import {normalizePem} from './config.mjs';
for(const v of ['NETSUITE_CLIENT_ID','NETSUITE_CERTIFICATE_ID','NETSUITE_PRIVATE_KEY_PEM'])console.log(v.padEnd(26),process.env[v]?'set':'MISSING');
const raw=process.env.NETSUITE_PRIVATE_KEY_PEM;if(!raw)process.exit(1);
const labels=[...raw.matchAll(/-----(BEGIN|END) ([A-Z ]+)-----/g)].map(m=>m[1]+' '+m[2]);
console.log('Key text: '+raw.length+' characters, '+raw.split('\n').length+' line(s), markers found: '+(labels.join(' / ')||'none'));
if(/CERTIFICATE/.test(labels.join()))console.log('PROBLEM: this is the certificate (public part). Paste the PRIVATE key file instead.');
if(/ENCRYPTED/.test(labels.join()))console.log('PROBLEM: the key is password-protected. Export it without a password (e.g. openssl ec -in key.pem -out plain.pem).');
try{const k=createPrivateKey(normalizePem(raw));const curve=k.asymmetricKeyDetails?.namedCurve;
 console.log('Key readable: '+k.asymmetricKeyType+(curve?' '+curve:''));
 console.log(k.asymmetricKeyType==='ec'&&curve==='prime256v1'?'OK: matches what NetSuite sign-in needs (ES256).':'PROBLEM: this app signs with ES256 and needs an EC prime256v1 (P-256) key, generated with: openssl req -new -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 730 -out cert.pem -keyout key.pem');
}catch(e){console.log('PROBLEM: key still not readable ('+e.message+'). Re-paste the whole key file, including the -----BEGIN ... and -----END ... lines.')}
