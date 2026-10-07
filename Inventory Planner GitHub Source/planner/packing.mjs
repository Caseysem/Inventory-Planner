// Pieces are indivisible within a sheet. Fractional remainders from yields > 1
// may share sheets, as agreed. Scope each call to one order and one parent.
export function packParent(parts) {
  const eps=1e-9, fractions=new Map();let whole=0;
  for(const part of parts){
    const qty=Number(part.qty),raw=part.yield;
    const yieldValue=raw==null||String(raw).trim()===''?1:Number(raw);
    if(!Number.isFinite(qty)||qty<0||!Number.isInteger(qty))return {error:'Item quantity must be a whole number'};
    if(!Number.isFinite(yieldValue)||yieldValue<=0)return {error:'Invalid yield'};
    const units=Math.floor(yieldValue),fraction=yieldValue-units;whole+=qty*units;
    if(fraction>eps)fractions.set(fraction,(fractions.get(fraction)||0)+qty);
  }
  if(!fractions.size)return {qty:whole};
  if(fractions.size===1){const [[size,count]]=fractions;return {qty:whole+Math.ceil(count/Math.floor((1+eps)/size))};}
  const count=[...fractions.values()].reduce((a,b)=>a+b,0);
  if(count>50000)return {error:'Sheet allocation needs review: too many mixed pieces'};
  const pieces=[...fractions].flatMap(([size,n])=>Array(n).fill(size)).sort((a,b)=>b-a),bins=[];
  for(const size of pieces){let chosen=-1,best=2;for(let i=0;i<bins.length;i++)if(bins[i]+eps>=size&&bins[i]<best){chosen=i;best=bins[i];}if(chosen<0)bins.push(1-size);else bins[chosen]-=size;}
  const lower=Math.ceil(pieces.reduce((a,b)=>a+b,0)-eps),upper=bins.length;
  if(lower===upper)return {qty:whole+upper};
  if(pieces.length>80)return {error:'Sheet allocation needs review: minimum not yet verified'};
  let visits=0;
  for(let limit=lower;limit<upper;limit++){
    const space=Array(limit).fill(1);
    function fit(index){if(index===pieces.length)return true;if(++visits>200000)throw new Error('limit');const size=pieces[index],seen=new Set();for(let i=0;i<space.length;i++){const signature=Math.round(space[i]*1e9);if(seen.has(signature)||space[i]+eps<size)continue;seen.add(signature);space[i]-=size;if(fit(index+1))return true;space[i]+=size;if(space[i]>1-eps)break;}return false;}
    try{if(fit(0))return {qty:whole+limit};}catch{return {error:'Sheet allocation needs review: minimum not yet verified'};}
  }
  return {qty:whole+upper};
}
