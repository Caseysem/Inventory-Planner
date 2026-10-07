import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {packParent} from '../planner/packing.mjs';
export function optimalPacking(parts){
 const basic=packParent(parts);if(!basic.error?.startsWith('Sheet allocation needs review'))return basic;
 const solved=spawnSync(process.env.PYTHON_BIN||'python3',[fileURLToPath(new URL('./optimal-packing.py',import.meta.url))],{input:JSON.stringify(parts),encoding:'utf8',timeout:20000,maxBuffer:10000});
 if(solved.error||solved.status!==0)return basic;
 try{return JSON.parse(solved.stdout)}catch{return basic;}
}
