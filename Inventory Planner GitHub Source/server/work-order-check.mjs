import assert from 'node:assert/strict';
import {plan} from '../planner/core.mjs';
const opt={date:'2026-10-07',days:90,overdue:true};
const m=(id,onHand,reorder)=>({id,sku:id,onHand,reorder,price:2});
const line=(material,order,ordered,source='salesOrder',status='Pending Fulfillment',ship='2026-10-07')=>({material,order,ordered,shipped:0,factor:1,source,status,ship,preRolledUp:true});
const data={materials:[m('assembly',10,20),m('component',50,30),m('unset',0,null)],lines:[line('assembly','SO1',15),line('component','SO2',5),line('component','WO1',20,'workOrder','Planned',null),line('component','WO2',100,'workOrder','Closed'),line('component','WO3',100,'workOrder','Released','2027-12-01')],receipts:[],workOrderReceipts:[{material:'assembly',order:'WO1',qty:10,status:'Planned',date:'2026-10-07'},{material:'assembly',order:'closed',qty:100,status:'Closed',date:'2026-10-07'}]};
let rows=plan(data,opt),assembly=rows.find(r=>r.id==='assembly'),component=rows.find(r=>r.id==='component');
assert.equal(assembly.workOrderSupply,10);assert.equal(assembly.projected,5);assert.equal(assembly.suggested,15);
assert.equal(component.workOrderDemand,20);assert.equal(component.demand,25);assert.equal(component.available,25);assert.equal(component.suggested,5);
assert.equal(component.later,100);assert.equal(rows.find(r=>r.id==='unset').suggested,null);
// Remaining quantities have already excluded builds/issues in the connector.
data.workOrderReceipts[0].qty=4;data.lines[2].ordered=8;
rows=plan(data,opt);assert.equal(rows[0].workOrderSupply,4);assert.equal(rows[1].workOrderDemand,8);
assert.equal(rows[0].shortage,1); // Same-day receipt is processed before sales demand.
data.workOrderReceipts[0].date='2027-12-01';rows=plan(data,opt);assert.equal(rows[0].workOrderSupply,4);assert.equal(rows[0].shortage,5);
console.log('Passed: Planned work orders, incoming builds, component demand, remaining quantities, completed/closed exclusions, future demand, same-day timing and missing reorder points.');
