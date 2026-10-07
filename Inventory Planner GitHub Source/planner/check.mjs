import assert from 'node:assert/strict';
import {addDays,bucket,remaining,plan,demoData} from './core.mjs';
assert.equal(addDays('2026-10-05',90),'2027-01-03');
const line={ordered:150,shipped:50,factor:2,issued:20,ship:'2027-01-03',closed:false,status:'Pending Fulfillment',inspected:false};assert.equal(remaining(line),200);assert.equal(bucket(line,'2026-10-05',90,true),'near');assert.equal(bucket({...line,ship:'2027-01-04'},'2026-10-05',90,true),'future');assert.equal(bucket({...line,ship:null},'2026-10-05',90,true),'undated');assert.equal(bucket({...line,closed:true},'2026-10-05',90,true),'closed');assert.equal(bucket({...line,ship:'2026-10-04'},'2026-10-05',90,true),'near');assert.equal(bucket({...line,ship:'2026-10-04'},'2026-10-05',90,false),'overdue');
const data={materials:[{id:'a',onHand:500,reorder:300,preferred:700,price:2,location:'Main'}],lines:[{...line,material:'a',ordered:150,shipped:0,factor:1,issued:0,ship:'2026-10-20'},{...line,material:'a',ordered:400,shipped:0,factor:1,issued:0,ship:'2027-06-01'}],receipts:[]};const o={date:'2026-10-05',days:90,overdue:true,location:'All locations'};let r=plan(data,o)[0];assert.equal(r.demand,150);assert.equal(r.later,400);assert.equal(r.available,350);assert.equal(r.suggested,0);data.materials[0].onHand=100;data.receipts=[{material:'a',approved:true,qty:200,date:'2026-11-01'}];r=plan(data,o)[0];assert.equal(r.shortage,50);assert.equal(r.projected,150);assert.equal(r.suggested,150);assert.equal(r.cost,300);assert.equal(plan(data,{...o,location:'Other'}).length,1);
const demo=demoData('2026-10-05'),now=plan(demo,o),later=plan(demo,{...o,date:'2027-03-05'});assert(now[0].later>0);assert.equal(later[0].later,0);assert(later[0].demand>now[0].demand);console.log('Passed: cutoff inclusivity, overdue policy, missing dates, partial fulfillment, material conversion, future exclusion, reorder math, receipt timing, no location filtering, and rolling window.');

assert.equal(bucket({...line,status:'Pending Approval'},o.date,90,true),'closed');
assert.equal(bucket({...line,inspected:true},o.date,90,true),'closed');
assert.equal(bucket({...line,inspected:undefined,custbodyqa_check:'T'},o.date,90,true),'closed');
const qtyLine={ordered:1,shipped:0,factor:.125,issued:0,ship:'2026-10-20',status:'Pending Fulfillment',closed:false,material:'a',product:'CHILD'};
const separate={materials:[{id:'a',onHand:0,reorder:10,price:1}],lines:[{...qtyLine,order:'SO1'},{...qtyLine,order:'SO2'}],receipts:[]};
assert.equal(plan(separate,o)[0].demand,2);
assert.equal(plan({...separate,lines:[{...qtyLine,order:'SO1'},{...qtyLine,order:'SO1'}]},o)[0].demand,1);
const poData={...separate,receipts:[{material:'a',approved:true,qty:2,date:'2027-10-01'},{material:'a',approved:true,qty:3,date:null},{material:'a',approved:true,qty:4,date:'2026-01-01'},{material:'a',approved:true,qty:99,closed:true},{material:'a',approved:true,qty:0}]};
const poResult=plan(poData,o)[0];assert.equal(poResult.supply,9);assert.equal(poResult.available,-2);assert.equal(poResult.suggested,3);
assert.equal(plan({...poData,receipts:[{material:'a',approved:true,qty:12,date:null}]},o)[0].suggested,0);
assert.equal(plan({...poData,lines:separate.lines.map(l=>({...l,inspected:true}))},o)[0].demand,0);
console.log('Passed: per-order rounding, same-order item consolidation, inspection/status filters, all open PO dates, closed PO exclusion, and reorder-point target.');

const timingLine={...qtyLine,ordered:15,factor:1,order:'TIMING',ship:'2026-10-20'};
const timingData={materials:[{id:'a',onHand:10,reorder:0,price:1}],lines:[timingLine],receipts:[{material:'a',qty:20,approved:true,date:'2026-10-20'}]};
assert.equal(plan(timingData,o)[0].shortage,0);assert.equal(plan(timingData,o)[0].suggested,0);
assert.equal(plan({...timingData,receipts:[{material:'a',qty:20,approved:true,date:'2026-10-19'}]},o)[0].shortage,0);
for(const receipt of [{material:'a',qty:20,approved:true,date:null},{material:'a',qty:20,approved:true,date:'2026-01-01'}]){const r=plan({...timingData,receipts:[receipt]},o)[0];assert.equal(r.supply,20);assert.equal(r.shortage,5);assert.equal(r.arrivalReview,1);}
assert.equal(plan({...timingData,lines:[{...timingLine,ship:null}]},o)[0].demand,15);
assert.equal(plan({...timingData,receipts:[{material:'a',qty:20,approved:false,date:'2026-10-10'}]},o)[0].supply,0);
assert.equal(plan({...timingData,receipts:[{material:'a',qty:20,approved:true,cancelled:true,date:'2026-10-10'}]},o)[0].supply,0);
assert.equal(plan({...timingData,materials:[{id:'a',onHand:10,reorder:null}]},o)[0].suggested,null);
assert.equal(plan({...timingData,materials:[{id:'a',onHand:10,reorder:15.4}],lines:[],receipts:[]},o)[0].suggested,6);
console.log('Passed: arrival before ship date, same-day arrivals accepted, missing/overdue arrivals, unapproved/cancelled POs, missing reorder points, whole-unit purchase rounding.');
