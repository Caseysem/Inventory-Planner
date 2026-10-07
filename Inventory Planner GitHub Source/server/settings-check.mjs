import assert from 'node:assert/strict';import {pullSettings} from './settings.mjs';import {NetSuiteReader} from './client.mjs';
const catalog=[{id:1},{id:2},{id:3}],rows=[{id:'1',reorder:'20',preferred:'30',location:'1',locationReorder:'5'},{id:'2',location:'1',locationReorder:'10',locationPreferred:'15'},{id:'2',location:'2',locationReorder:'30',locationPreferred:'45'},{id:'3',reorder:''}];
const r={readSettings:async page=>({items:rows,page,hasMore:false,total:rows.length})};
const c=await pullSettings(r,catalog,{});assert.equal(c[1].reorder,20);assert.equal(c[2].reorder,null);assert.equal(c[3].reorder,null);
assert.equal((await pullSettings(r,catalog,{locationReorderPolicy:'average'}))[2].reorder,20);
await assert.rejects(()=>pullSettings({readSettings:async()=>({items:rows,page:0,total:99,hasMore:false})},catalog,{}),/Incomplete/);
const reader=new NetSuiteReader({baseUrl:'https://3646375.suitetalk.api.netsuite.com',settingsUrl:'https://example.com/app/site/hosting/restlet.nl?script=1&deploy=1'});await assert.rejects(()=>reader.readSettings(),/Invalid settings/);
console.log('Passed: settings completeness, missing values, multiple-location review, global precedence and endpoint restriction.');
