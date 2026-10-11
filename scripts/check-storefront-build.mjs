import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { renderStorefront, renderSitemap, isSaleProduct } from '../src/storefront-html.js';
import { catalogReader, storefrontHandler } from '../api/storefront.js';
const root = new URL('../', import.meta.url);
await assert.rejects(access(new URL('dist/index.html', root)), { code: 'ENOENT' });
const template = await readFile(new URL('server/storefront-template.html', root), 'utf8');
const snapshot = JSON.parse(await readFile(new URL('server/storefront-catalog.json', root), 'utf8'));
const config = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
assert.equal(config.functions['api/storefront.js'].includeFiles, 'server/storefront-*');
assert.ok(config.rewrites.some(rule => rule.source === '/' && rule.destination === '/api/storefront?path=/'));
assert.ok(config.redirects.some(rule => rule.source === '/index.html' && rule.destination === '/' && rule.permanent));
for (const asset of template.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) await access(new URL('dist' + asset[1], root));
const html = renderStorefront({ template, ...snapshot.catalog });
assert.match(html, /<h1>Hoa tươi Long Thành, Đồng Nai<\/h1>/);
assert.match(html, /rel="canonical"/);
const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
assert.equal(graph[0]['@type'], 'Florist');
const sale = snapshot.catalog.products.filter(product => isSaleProduct(product));
const sitemap = renderSitemap(snapshot.catalog.products);
assert.equal((sitemap.match(/<url>/g)||[]).length, sale.length + 1);
for (const product of snapshot.catalog.products.filter(product=>product.reference_only)) assert.ok(!sitemap.includes('/hoa/' + product.slug + '<'));
assert.ok(!JSON.stringify(snapshot).includes('sb_publishable_'));
const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; return this; }, send(body) { this.body = body; return this; }, end(body = '') { return this.send(body); } });
const handler = storefrontHandler({ catalog: async () => snapshot.catalog, template: async () => template, preview: () => false });
for (const product of snapshot.catalog.products) {
  const res = response();
  await handler({ method: 'GET', query: { path: '/hoa/' + product.slug } }, res);
  assert.equal(res.code, 200);
  assert.match(res.body, /id="buy"/);
  assert.doesNotMatch(res.body, /og:image:(width|height)/);
  const ogImage = res.body.match(/property="og:image" content="([^"]+)"/)[1];
  assert.equal(res.body.match(/name="twitter:image" content="([^"]+)"/)[1], ogImage);
  const productGraph = JSON.parse(res.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'][1];
  assert.equal(productGraph['@type'], 'Product');
  if (!isSaleProduct(product)) {
    assert.equal(res.headers['X-Robots-Tag'], 'noindex, follow');
    assert.match(res.body, /name="robots" content="noindex,follow"/);
    assert.ok(!productGraph.offers);
    assert.doesNotMatch(res.body, /href="#buy"/);
  } else {
    assert.equal(productGraph.offers.price, product.price);
    assert.match(res.body, /href="#buy"/);
  }
}
const fallback = catalogReader(async () => { throw new Error('simulated outage'); }, async () => snapshot.catalog);
const fallbackHandler = storefrontHandler({ catalog: fallback, template: async () => template, preview: () => false });
for (const path of ['/', '/hoa/' + sale[0].slug, '/sitemap.xml']) {
  const res = response();
  await fallbackHandler({ method: 'GET', query: { path } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers['X-Garden-Catalog'], 'fallback');
  assert.match(res.headers['Cache-Control'], /stale-while-revalidate=300/);
  if (path !== '/sitemap.xml') {
    assert.doesNotMatch(res.body, /href="#buy"/);
    assert.doesNotMatch(res.body, /"@type":"Offer"/);
  }
}
console.log(`Build contract passed: no static index, private template/assets valid, ${sale.length+1} sitemap URLs, valid Florist JSON-LD.`);
console.log(`Issue checks passed: ${snapshot.catalog.products.length} product pages and three catalog-outage routes (#11, #12).`);
