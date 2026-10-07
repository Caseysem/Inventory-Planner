import assert from 'node:assert/strict';
import {compareItems} from './sync.mjs';
const before=[{id:1,sku:'A',yield:.4},{id:2,sku:'B'},{id:3,sku:'C'}];
const snapshot={complete:true,filtered:false,scope:'account-role',items:[{id:1,sku:'A-RENAMED',yield:.35},{id:2,sku:'B'},{id:4,sku:'D'}]};
const result=compareItems(before,snapshot,'account-role');
assert.deepEqual(result.counts,{added:1,updated:1,removed:1,unchanged:1});
assert.equal(result.changes.filter(c=>c.action==='Updated').length,2);
assert.equal(before[0].sku,'A');
for(const invalid of [{...snapshot,complete:false},{...snapshot,filtered:true},{...snapshot,scope:'other-role'},{...snapshot,items:[{id:1},{id:'1'}]},{...snapshot,items:[{sku:'No ID'}]}])
  assert.throws(()=>compareItems(before,invalid,'account-role'));
console.log('Catalog comparison and incomplete-pull guards passed.');
