export function materialStatus(row) {
  if(row.packingError)return 'Allocation needs review';if(row.available!==null&&!Number.isFinite(row.reorder))return 'Missing reorder point';return row.available === null ? 'Awaiting NetSuite' : row.shortage ? 'Timing shortage' : row.suggested ? 'Needs reorder' : 'Covered';
}
export function sortMaterials(rows, key, direction = 'asc') {
  const names = new Intl.Collator('en-US', {numeric: true, sensitivity: 'base'});
  const numeric = new Set(['onHand', 'demand', 'later', 'available', 'supply', 'workOrderSupply', 'reorder', 'preferred', 'suggested']);
  return [...rows].sort((a, b) => {
    const left = key === 'status' ? materialStatus(a) : a[key];
    const right = key === 'status' ? materialStatus(b) : b[key];
    const missingLeft = numeric.has(key) ? !Number.isFinite(left) : left == null;
    const missingRight = numeric.has(key) ? !Number.isFinite(right) : right == null;
    if (missingLeft !== missingRight) return missingLeft ? 1 : -1;
    const order = missingLeft ? 0 : numeric.has(key) ? left - right : names.compare(String(left), String(right));
    return (direction === 'desc' ? -order : order) || names.compare(a.sku, b.sku) || names.compare(String(a.id), String(b.id));
  });
}
