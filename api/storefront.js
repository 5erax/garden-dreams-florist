import { readFile } from 'node:fs/promises';
import { checkEnvironment } from '../src/environment.js';
import { productFromPath } from '../src/product-url.js';
import { renderStorefront, renderSitemap } from '../src/storefront-html.js';

export async function publicCatalog(env, fetcher = fetch) {
  const config = checkEnvironment(env);
  if (!config.projectRef) throw new Error('REMOTE_BACKEND_REQUIRED');
  const read = async path => {
    const response = await fetcher(`${config.url}/rest/v1/${path}`, { headers: { apikey: config.key }, signal: AbortSignal.timeout(2500) });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error('CATALOG_UNAVAILABLE', { cause: { status: response.status, code: detail.code } });
    }
    return response.json();
  };
  const shopsRead = read('gd_shop?select=name,phone,address,accepting_orders&id=eq.1').catch(error => {
    if (error.cause?.code !== '42703') throw error;
    return read('gd_shop?select=name,phone,accepting_orders&id=eq.1');
  });
  const [shops, products] = await Promise.all([shopsRead, read('gd_products?select=id,slug,name,occasion,stems,description,image,price,active,reference_only&or=(active.eq.true,reference_only.eq.true)&order=id.asc')]);
  if (shops.length !== 1 || !Array.isArray(products) || products.some(item => !Number.isSafeInteger(item.price) || item.price < 0 || !/^bo-hoa-\d+$/.test(item.slug))) throw new Error('CATALOG_INVALID');
  return { shop: shops[0], products };
}

export function catalogReader(readLive, readSnapshot, now = Date.now) {
  let good, freshUntil = 0, pending;
  return async () => {
    if (good && now() < freshUntil) return { ...good, degraded: false };
    if (!pending) pending = (async () => {
      try {
        good = await readLive(); freshUntil = now() + 60000;
        return { ...good, degraded: false };
      } catch {
        // shortcut: build snapshot is read-only until a successful refresh or next deployment.
        const fallback = good || await readSnapshot();
        return { ...fallback, shop: { ...fallback.shop, accepting_orders: false }, degraded: true };
      } finally { pending = null; }
    })();
    return pending;
  };
}
const readCatalog = catalogReader(() => publicCatalog(process.env), async () => {
  const snapshot = JSON.parse(await readFile(new URL('../server/storefront-catalog.json', import.meta.url), 'utf8'));
  const config = checkEnvironment(process.env);
  if (snapshot.projectRef !== config.projectRef || snapshot.environment !== config.environment) throw new Error('SNAPSHOT_ENV_MISMATCH');
  return snapshot.catalog;
});
export function storefrontHandler({ catalog = readCatalog, template = () => readFile(new URL('../server/storefront-template.html', import.meta.url), 'utf8'), preview = () => process.env.VERCEL_ENV !== 'production' } = {}) {
  return async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, HEAD').end();
    const path = req.query?.path || '/';
    if (typeof path !== 'string' || !/^\/(?:hoa\/bo-hoa-[1-9]\d*\/?|sitemap\.xml)?$/.test(path)) return res.status(404).end('Không tìm thấy trang.');
    try {
      const data = await catalog();
      const noindex = preview();
      if (noindex) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400');
      res.setHeader('X-Garden-Catalog', data.degraded ? 'fallback' : 'live');
      if (path === '/sitemap.xml') return res.setHeader('Content-Type', 'application/xml; charset=utf-8').send(req.method === 'HEAD' ? '' : renderSitemap(data.products));
      const product = path === '/' ? undefined : productFromPath(path, data.products);
      if (path !== '/' && !product) return res.status(404).setHeader('Cache-Control', 'no-store').send('Bó hoa này hiện không được bán.');
      if (product?.reference_only && !noindex) res.setHeader('X-Robots-Tag', 'noindex, follow');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(req.method === 'HEAD' ? '' : renderStorefront({ template: await template(), ...data, product, preview: noindex }));
    } catch {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Retry-After', '60');
      return res.status(503).send('Bộ sưu tập chưa khả dụng. Vui lòng thử lại sau ít phút.');
    }
  };
}
export default storefrontHandler();
