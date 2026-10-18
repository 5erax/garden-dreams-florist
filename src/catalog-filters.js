import { occasions } from './catalog.js';
const colors = ['hồng','đỏ','trắng','vàng','tím','xanh'];
const types = ['hồng','mẫu đơn','ly','cẩm tú cầu','cẩm chướng','hướng dương','tulip'];
const budgets = [0,300000,500000,800000,1500000];
export function readCatalogFilters(search = '') {
  const p = new URLSearchParams(search);
  return {
    query: (p.get('q') || '').slice(0,100),
    occasion: [...occasions,'20/10'].includes(p.get('occasion')) ? p.get('occasion') : 'Tất cả',
    flowerColor: colors.includes(p.get('color')) ? p.get('color') : '',
    flowerType: types.includes(p.get('type')) ? p.get('type') : '',
    budget: budgets.includes(Number(p.get('budget'))) ? Number(p.get('budget')) : 0,
    sort: ['low','high'].includes(p.get('sort')) ? p.get('sort') : 'featured',
    saleOnly: p.get('references') !== '1',
  };
}
export function catalogFilterUrl(href, filters) {
  const url = new URL(href);
  const values = {q:filters.query,occasion:filters.occasion==='Tất cả'?'':filters.occasion,color:filters.flowerColor,type:filters.flowerType,budget:filters.budget||'',sort:filters.sort==='featured'?'':filters.sort,references:filters.saleOnly?'':'1'};
  for (const [name,value] of Object.entries(values)) {
    if (value) url.searchParams.set(name,String(value)); else url.searchParams.delete(name);
  }
  return url.pathname + url.search + url.hash;
}
