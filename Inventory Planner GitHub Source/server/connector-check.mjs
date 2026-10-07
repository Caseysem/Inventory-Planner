import assert from 'node:assert/strict';import {NetSuiteReader} from './client.mjs';import {date,truth,today} from './pull.mjs';
const reader=new NetSuiteReader({baseUrl:'https://3646375.suitetalk.api.netsuite.com'});
for(const q of ['DELETE FROM item','UPDATE item SET id=1','SELECT id FROM item; DELETE FROM item','SELECT id FROM item;'])await assert.rejects(()=>reader.query(q),/single SELECT/);
for(const path of ['salesOrder/123','inventoryItem/123/vendor','../transaction/123'])await assert.rejects(()=>reader.readRecord(path),/Unsupported read endpoint/);
assert.throws(()=>new NetSuiteReader({baseUrl:'https://example.com'}));
assert.equal(date('12/7/2026'),'2026-12-07');assert.equal(date('2026-12-07'),'2026-12-07');assert.equal(date(null),null);assert.equal(truth('F'),false);assert.equal(truth('T'),true);assert.match(today(),/^\d{4}-\d{2}-\d{2}$/);
console.log('Passed: NetSuite writes blocked, destination restricted, date/checkbox normalization verified.');
