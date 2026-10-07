import assert from 'node:assert/strict';
import {resolveParent,rollupOrders} from './rollup.mjs';
import {packParent} from './packing.mjs';
import {bucket} from './core.mjs';
const catalog=[{id:1,sku:'P',parent:'P',yield:1},{id:2,sku:'MID',parent:'P',yield:2},{id:3,sku:'CHILD',parent:'MID',yield:.25},{id:4,sku:'NO-YIELD',parent:'P',yield:null},{id:5,sku:'MISSING',parent:'ABSENT',yield:1},{id:6,sku:'DUP',parent:'P',yield:.1},{id:7,sku:'DUP',parent:'P',yield:.2}];
const orders=[3,4,5,6,7].map(itemId=>({itemId,qty:10,ship:'2026-10-20'}));
const result=rollupOrders(orders,catalog,'2026-10-06',90,true,bucket);
assert.equal(result.groups.find(g=>g.parent.id===2).demand,3);
assert.equal(result.groups.find(g=>g.parent.id===1).demand,19);
assert.equal(result.details.find(d=>d.itemId===5).ignored,true);
assert.equal(result.details.find(d=>d.itemId===4).usage[0].qty,10);
assert.equal(result.details.filter(d=>d.item.sku==='DUP').length,2);
assert.equal(result.details.find(d=>d.itemId===3).usage.length,2);
assert.equal(resolveParent({...catalog[4],yield:null},catalog).ignored,true);
assert(resolveParent({id:8,sku:'INVALID',parent:'P',yield:0},catalog).error);
const cycle=[{id:10,sku:'A',parent:'B',yield:1},{id:11,sku:'B',parent:'A',yield:1}];assert.equal(resolveParent(cycle[0],cycle).error,'Parent cycle');
console.log('Passed: missing parents skipped, blank yields default to one, duplicates kept separate, both parent levels reported, invalid yields and cycles surfaced.');

for(const [yieldValue,pieces] of [[.4,2],[.35,2],[.125,8]]){
 const items=[{id:1,sku:'P',parent:'P',yield:1},{id:2,sku:'C',parent:'P',yield:yieldValue}];
 const usage=rollupOrders([{itemId:2,qty:10,ship:'2026-10-20'}],items,'2026-10-06',90,true,bucket).details[0].usage[0];
 assert.equal(usage.qty,Math.ceil(10/pieces));
}
console.log('Passed: whole-piece fractional yields at each parent level.');

const mixed=[{id:1,sku:'P',parent:'P',yield:1},...[[.4,2],[.35,3],[.125,4]].map(([yieldValue,id])=>({id,sku:'C'+id,parent:'P',yield:yieldValue}))];
const sharedOrders=[{itemId:2,qty:1,order:'SHARED',ship:null},{itemId:3,qty:1,order:'SHARED',ship:null},{itemId:4,qty:2,order:'SHARED',ship:null}];
assert.equal(rollupOrders(sharedOrders,mixed,'2026-10-06',90,true,bucket).groups[0].demand,1);
assert.equal(rollupOrders(sharedOrders.map((o,i)=>({...o,order:'SEPARATE'+i})),mixed,'2026-10-06',90,true,bucket).groups[0].demand,3);
assert.equal(packParent([{qty:3,yield:1.5}]).qty,5);
assert.equal(packParent([{qty:3,yield:.35}]).qty,2);
assert.equal(packParent([{qty:1,yield:.4},{qty:1,yield:.35},{qty:2,yield:.125}]).qty,1);
assert.equal(packParent([{qty:1,yield:' '}]).qty,1);
assert(packParent([{qty:1,yield:'bad'}]).error);
console.log('Passed: shared leftovers by order and parent, no sharing between orders, missing dates counted, yields above one and blank yields.');

assert.equal(rollupOrders([{itemId:1,qty:7,ship:'2026-10-20'}],catalog,'2026-10-06',90,true,bucket).groups[0].demand,7);
