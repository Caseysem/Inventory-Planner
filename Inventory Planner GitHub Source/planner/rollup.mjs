import {packParent} from './packing.mjs';
export function resolveParent(item,catalog){
 const names=new Map();for(const i of catalog){if(!names.has(i.sku))names.set(i.sku,[]);names.get(i.sku).push(i)}
 let current=item,factor=1;const path=[],levels=[],seen=new Set();
 while(current.parent&&current.parent!==current.sku){
  if(seen.has(String(current.id)))return {error:'Parent cycle',path};seen.add(String(current.id));
  const assumedYield=current.yield===null||current.yield===undefined||String(current.yield).trim()==='';
  const yieldValue=assumedYield?1:Number(current.yield);
  if(!Number.isFinite(yieldValue)||yieldValue<=0)return {error:'Invalid yield for '+current.sku,path};
  const candidates=names.get(current.parent)||[];
  if(!candidates.length)return {ignored:true,reason:'Parent not found: '+current.parent,path};
  // Duplicate names remain separate records. Parent IDs disambiguate parent targets.
  const parent=current.parentInternalId!=null?candidates.find(i=>String(i.id)===String(current.parentInternalId)):candidates.length===1?candidates[0]:null;
  if(!parent)return {error:'Parent internal ID needed for duplicate parent name: '+current.parent,path};
  factor*=yieldValue;path.push({sku:current.sku,parent:parent.sku,yield:yieldValue,assumedYield});
  levels.push({parent,factor,assumedYield,path:[...path]});current=parent;
 }
 if(!levels.length)levels.push({parent:current,factor:1,assumedYield:false,path:[]});
 return {parent:current,factor,path,levels};
}
export function rollupOrders(orders,catalog,date,days,includeOverdue,bucket,packingFunction=packParent){
 const groups=new Map(),details=[],orderGroups=new Map(),byId=new Map(catalog.map(i=>[String(i.id),i]));
 for(const order of orders){
  const item=byId.get(String(order.itemId));if(!item){details.push({...order,error:'Item not found'});continue}
  const resolved=resolveParent(item,catalog);if(resolved.ignored||resolved.error){details.push({...order,item,...resolved});continue}
  const qty=Math.max(0,Number(order.qty)-Number(order.shipped||0));
  const treatment=bucket({ordered:qty,shipped:0,factor:1,ship:order.ship,closed:order.closed??false,cancelled:order.cancelled??false,status:order.status??'Pending Fulfillment',inspected:order.inspected??order.custbodyqa_check??false},date,days,includeOverdue);
  const detail={...order,item,...resolved,treatment,usage:[]};details.push(detail);
  if(treatment==='closed')continue;
  const key=JSON.stringify([order.order||'TEST-'+(order.id??order.itemId),order.ship,treatment,String(resolved.parent.id)]);
  if(!orderGroups.has(key))orderGroups.set(key,[]);orderGroups.get(key).push({detail,qty});
 }
 for(const sources of orderGroups.values()){
  const direct=new Map(),nodes=new Map(),input=new Map(),usage=new Map();
  for(const {detail,qty} of sources){const id=String(detail.item.id);direct.set(id,(direct.get(id)||0)+qty);nodes.set(id,{item:detail.item,depth:detail.path.length});detail.levels.forEach((l,index)=>nodes.set(String(l.parent.id),{item:l.parent,depth:Math.max(0,detail.path.length-index-1)}));}
  const sorted=[...nodes.values()].sort((a,b)=>b.depth-a.depth);let error;
  for(const {item,depth} of sorted){
   const id=String(item.id),parts=input.get(id)||[];const packed=packingFunction(parts);
   if(packed.error){error=packed.error;break}
   const qty=(direct.get(id)||0)+packed.qty;
   if(parts.length||depth===0)usage.set(id,{parent:item,qty,purchasing:!item.parent||item.parent===item.sku});
   if(depth>0){const resolution=resolveParent(item,catalog),parent=resolution.levels[0].parent,key=String(parent.id);if(!input.has(key))input.set(key,[]);input.get(key).push({qty,yield:item.yield});}
  }
  if(error){for(const {detail} of sources)detail.error=error;continue;}
  const treatment=sources[0].detail.treatment;
  for(const [key,level] of usage){if(!groups.has(key))groups.set(key,{parent:level.parent,demand:0,future:0,review:0,purchasing:level.purchasing});const g=groups.get(key);if(['near','undated'].includes(treatment))g.demand+=level.qty;else if(treatment==='future')g.future+=level.qty;else g.review+=level.qty;}
  for(const {detail} of sources){detail.usage=detail.levels.map(level=>({...level,qty:usage.get(String(level.parent.id))?.qty??0,shared:true}));detail.qtyParent=detail.usage.at(-1)?.qty??0;}
 }
 return {groups:[...groups.values()],details};
}
