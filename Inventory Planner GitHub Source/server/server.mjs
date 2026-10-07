import http from 'node:http';import {readFile} from 'node:fs/promises';import {randomBytes} from 'node:crypto';
import {pullReport,stateDir,root} from './pull.mjs';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0',origin=process.env.APP_ORIGIN||`http://127.0.0.1:${port}`,session=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');let busy=false,message='Ready';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try{
  const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if(!loopback||process.env.REPL_ID||process.env.REPLIT_DEPLOYMENT||process.env.REPLIT_DOMAINS||!['127.0.0.1','localhost'].includes(new URL(origin).hostname)){res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<h1>Inventory Planner imported</h1><p>The application package is running. Team authentication must be added before cloud access to inventory or refreshes is enabled.</p>');return;}
  if(req.headers.host!==new URL(origin).host){json(res,403,{error:'Invalid host'});return;}
  const url=new URL(req.url,origin);
  if(req.method==='GET'&&url.pathname==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`planner_session=${session}; HttpOnly; SameSite=Strict; Path=/`,'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff'});res.end(await readFile(root+'/server/live.html'));return;
  }
  if(!(req.headers.cookie||'').split(';').some(c=>c.trim()==='planner_session='+session)){json(res,403,{error:'Open the planner workspace first'});return;}
  if(req.headers.origin&&req.headers.origin!==origin){json(res,403,{error:'Invalid origin'});return;}
  if(req.method==='GET'&&url.pathname==='/api/session'){json(res,200,{csrf});return;}
  if(req.method==='GET'&&url.pathname==='/api/status'){json(res,200,{busy,message});return;}
  if(req.method==='GET'&&url.pathname==='/api/report'){json(res,200,JSON.parse(await readFile(stateDir+'/live-report.json','utf8')));return;}
  if(req.method==='POST'&&url.pathname==='/api/refresh'){
   if(req.headers.origin!==origin||req.headers['x-planner-csrf']!==csrf){json(res,403,{error:'Refresh must come from this planner'});return;}
   if(busy){json(res,409,{error:'A refresh is already running'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1000){json(res,413,{error:'Request too large'});return;}}
   const {mode}=JSON.parse(body);if(!['items','report'].includes(mode)){json(res,400,{error:'Unknown refresh mode'});return;}
   busy=true;try{const report=await pullReport({updateItems:mode==='items',onProgress:m=>message=m});json(res,200,report);}catch(e){message='Refresh failed; previous report retained';json(res,502,{error:e.message});}finally{busy=false;}return;
  }
  json(res,404,{error:'Not found'});
 }catch(e){json(res,500,{error:e.code==='ENOENT'?'No successful report available yet':e.message});}
});
server.listen(port,host,()=>console.log('Inventory Planner: '+origin));
