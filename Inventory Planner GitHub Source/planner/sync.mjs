// Reconcile only a complete, unfiltered snapshot from the same NetSuite scope.
// This pure comparison never writes to NetSuite or modifies its inputs.
export function compareItems(previous, snapshot, previousScope) {
  if (!snapshot.complete || snapshot.filtered || snapshot.scope !== previousScope)
    throw new Error('The catalog pull is incomplete or its access scope changed. Keep the current catalog and retry.');
  const fields = ['sku', 'display', 'description', 'type', 'parent', 'parentInternalId', 'yield', 'location', 'line', 'active'];
  function index(items) {
    const result = new Map();
    for (const item of items) {
      if (item.id === undefined || item.id === null || String(item.id) === '' || result.has(String(item.id)))
        throw new Error('Missing or duplicate internal IDs. Keep the current catalog and review the pull.');
      result.set(String(item.id), item);
    }
    return result;
  }
  const oldItems = index(previous), newItems = index(snapshot.items);
  const changes = [], counts = {added: 0, updated: 0, removed: 0, unchanged: 0};
  for (const [id, item] of newItems) {
    const old = oldItems.get(id);
    if (!old) {
      counts.added++; changes.push({action: 'Added', id, sku: item.sku, field: 'Item', before: null, after: item.sku});
      continue;
    }
    const differences = fields.filter(field => (old[field] ?? null) !== (item[field] ?? null));
    if (!differences.length) {counts.unchanged++; continue;}
    counts.updated++;
    for (const field of differences) changes.push({action: 'Updated', id, sku: item.sku, field, before: old[field] ?? null, after: item[field] ?? null});
  }
  for (const [id, item] of oldItems) if (!newItems.has(id)) {
    counts.removed++; changes.push({action: 'Removed from tool', id, sku: item.sku, field: 'Item', before: item.sku, after: null});
  }
  return {counts, changes, total: snapshot.items.length};
}
