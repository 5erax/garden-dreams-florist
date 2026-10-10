export { searchableText as normalizeSearch } from './customer-history.js';
export const productSlug = product => product.slug || `bo-hoa-${product.id}`;
export const productUrl = product => `/hoa/${productSlug(product)}`;
export function productFromPath(path, products) {
  return products.find(product => productUrl(product) === path.replace(/\/$/, ''));
}
