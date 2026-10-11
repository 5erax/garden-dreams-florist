export { searchableText as normalizeSearch } from './customer-history.js';
export const productSlug = product => product.slug || `bo-hoa-${product.id}`;
export const productUrl = product => `/hoa/${productSlug(product)}`;
export const productTitle = product => product.stems ? product.name + ' — bó ' + product.stems.split(',')[0].toLocaleLowerCase('vi') : product.name;
export function productFromPath(path, products) {
  const clean=path.replace(/\/$/, '');
  return products.find(product => productUrl(product) === clean) || products.find(product=>clean===`/hoa/bo-hoa-${product.id}`);
}
