import { productSlug } from './product-url.js';
export function quickViewUrl(href, product) {
  const url = new URL(href);
  if (product) url.searchParams.set('flower', productSlug(product));
  else url.searchParams.delete('flower');
  return url.pathname + url.search + url.hash;
}
export function quickViewFromUrl(search, products) {
  const slug = new URLSearchParams(search).get('flower');
  return products.find(product => productSlug(product) === slug) || null;
}
