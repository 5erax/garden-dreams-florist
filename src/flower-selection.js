import { cartChoice } from './order.js';
export function startingPrice(product) {
  const prices = [cartChoice({ id: product.id }, [product]), ...(product.variants || []).map(v => cartChoice({ id: product.id, variantId: v.id }, [product]))]
    .filter(Boolean).map(choice => choice.price).filter(price => Number.isSafeInteger(price) && price > 0);
  return prices.length ? Math.min(...prices) : product.price;
}
export function withinBudget(product, ceiling, saleOnly) {
  return (!ceiling || startingPrice(product) <= ceiling) && (!saleOnly || (product.active !== false && !product.reference_only));
}
export function toggleComparison(ids, id) {
  if (ids.includes(id)) return ids.filter(value => value !== id);
  return ids.length < 3 ? [...ids, id] : ids;
}
import { normalizeSearch } from './product-url.js';
export function matchesFlowerDescription(product, color, type) {
  const parts = normalizeSearch(product.stems || '').split(/[,;]/).map(part => part.trim());
  const species = 'cam tu cau|cam chuong|huong duong|mau don|lan ho diep|hong|tulip|ly';
  const colors = parts.map(part => part.replace(new RegExp(`^(?:hoa )?(?:${species})(?= |$) *`), ''));
  const typeText = normalizeSearch(type);
  const colorText = normalizeSearch(color);
  return (!type || parts.some(part => part === typeText || part.startsWith(typeText + ' ') || part.startsWith('hoa ' + typeText + ' ')))
    && (!color || colors.some(part => part.split(/\s+/).includes(colorText) || colorText === 'hong' && part.split(/\s+/).includes('phan')));
}
