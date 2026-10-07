const number=v=>v==null||String(v).trim()===''?null:Number(v);
export async function pullSavedSearchSettings(reader,catalog,config,onProgress){
 const rows=[];let total;
 for(let offset=0;;){
  const result=await reader.readSavedSearch(config.settingsSearchId,{limit:1000,offset});
  if(!Array.isArray(result.items)||!Number.isInteger(result.totalResults)||result.offset!==offset)throw new Error('Invalid saved search response');
  if(total===undefined)total=result.totalResults;else if(total!==result.totalResults)throw new Error('Saved search changed during retrieval; please refresh again');
  rows.push(...result.items);onProgress?.('Reading reorder settings: '+rows.length+' of '+total+' rows');
  if(!result.hasMore)break;
  if(!result.items.length||rows.length>100000)throw new Error('Incomplete saved search results');offset+=result.items.length;
 }
 if(rows.length!==total)throw new Error('Incomplete saved search results');
 return savedSearchSettings(rows,catalog,config.settingsSearchId);
}
export function savedSearchSettings(rows,catalog,searchId){
 const field=(row,name)=>{const keys=Object.keys(row).filter(k=>k.toLowerCase().replace(/\[\d+\]$/,'')===name);if(keys.length>1)throw new Error('Ambiguous saved search column: '+name);return keys.length?row[keys[0]]:undefined;};
 const grouped=new Map();
 for(const row of rows){
  const raw=field(row,'internalid'),id=String(raw?.id??raw??'');
  if(!/^[0-9]+$/.test(id))throw new Error('Saved search needs an Internal ID results column');
  const point=number(field(row,'reorderpoint')),preferred=number(field(row,'preferredstocklevel'));
  if(point!==null&&(!Number.isFinite(point)||point<0)||preferred!==null&&(!Number.isFinite(preferred)||preferred<0))throw new Error('Invalid reorder settings for item '+id);
  const previous=grouped.get(id);
  if(previous&&(previous.reorder!==point||previous.preferred!==preferred))throw new Error('Conflicting saved search settings for item '+id+'; use one row per item');
  grouped.set(id,{reorder:point,preferred});
 }
 const cache={};for(const item of catalog){const settings=grouped.get(String(item.id));cache[item.id]={readAt:new Date().toISOString(),reorder:settings?.reorder??null,preferred:settings?.preferred??null,source:'Saved search '+searchId,unit:'base unit',error:settings?null:'Item not returned by settings search'};}
 return cache;
}
export async function pullSettings(reader,catalog,config,onProgress){
 const rows=[];let total;
 for(let page=0;;page++){
  const response=await reader.readSettings(page);
  if(!Array.isArray(response.items)||!Number.isInteger(response.total)||response.page!==page)throw new Error('Invalid settings response');
  if(total==null)total=response.total;else if(total!==response.total)throw new Error('Settings changed during retrieval');
  rows.push(...response.items);onProgress?.('Reading reorder settings: '+rows.length+' rows');
  if(!response.hasMore)break;if(!response.items.length||page>100)throw new Error('Incomplete settings pull');
 }
 if(rows.length!==total)throw new Error('Incomplete settings response');
 const grouped=new Map();for(const row of rows){const id=String(row.id);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(row);}
 const cache={};
 for(const item of catalog){
  const source=grouped.get(String(item.id))||[],global=[...new Set(source.map(r=>number(r.reorder)).filter(Number.isFinite))],globalPref=[...new Set(source.map(r=>number(r.preferred)).filter(Number.isFinite))];
  const locations=new Map();for(const row of source){if(!row.location)continue;const key=String(row.location),point=number(row.locationReorder),pref=number(row.locationPreferred);const previous=locations.get(key);if(previous&&(previous.reorder!==point||previous.preferred!==pref))throw new Error('Conflicting location settings for item '+item.id);locations.set(key,{id:key,reorder:point,preferred:pref});}
  const points=[...locations.values()].map(l=>l.reorder).filter(Number.isFinite),prefs=[...locations.values()].map(l=>l.preferred).filter(Number.isFinite);
  const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const useLocations=points.length===1||config.locationReorderPolicy==='average';
  cache[item.id]={readAt:new Date().toISOString(),reorder:global.length===1?global[0]:global.length>1?null:useLocations?average(points):null,preferred:globalPref.length===1?globalPref[0]:useLocations?average(prefs):null,locationCount:locations.size,locations:[...locations.values()],source:global.length?'Item reorder point':'Location reorder points',unit:'base unit',error:global.length>1?'Conflicting item reorder points':!useLocations&&points.length?'Multiple location reorder points need an aggregation decision':null};
 }
 return cache;
}
