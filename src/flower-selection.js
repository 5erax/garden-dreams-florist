export function withinBudget(product, ceiling, saleOnly) {
  return (!ceiling || product.price <= ceiling) && (!saleOnly || (product.active !== false && !product.reference_only));
}
export function toggleComparison(ids, id) {
  if (ids.includes(id)) return ids.filter(value => value !== id);
  return ids.length < 3 ? [...ids, id] : ids;
}
