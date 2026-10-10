import { readFile } from 'node:fs/promises';
import { checkEnvironment } from '../src/environment.js';
import { productFromPath } from '../src/product-url.js';
import { renderStorefront, renderSitemap } from '../src/storefront-html.js';

export async function publicCatalog(env, fetcher = fetch) {
  const config = checkEnvironment(env);
  if (!config.projectRef) throw new Error('REMOTE_BACKEND_REQUIRED');
  const read = async path => {
    const response = await fetcher(`${config.url}/rest/v1/${path}`, { headers: { apikey: config.key }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
    return response.json();
  };
  const [shops, products] = await Promise.all([read('gd_shop?select=name,phone,address,accepting_orders&id=eq.1'), read('gd_products?select=id,slug,name,occasion,stems,description,image,price,active,reference_only&or=(active.eq.true,reference_only.eq.true)&order=id.asc')]);
  if (shops.length !== 1 || !Array.isArray(products) || products.some(item => !Number.isSafeInteger(item.price) || item.price < 0 || !/^bo-hoa-\d+$/.test(item.slug))) throw new Error('CATALOG_INVALID');
  return { shop: shops[0], products };
}
export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, HEAD').end();
  const path = req.query?.path || '/';
  if (typeof path !== 'string' || !/^\/(?:hoa\/bo-hoa-[1-9]\d*\/?|sitemap\.xml)?$/.test(path)) return res.status(404).end('Không tìm thấy trang.');
  try {
    const catalog = await publicCatalog(process.env);
    const preview = process.env.VERCEL_ENV !== 'production';
    if (preview) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    if (path === '/sitemap.xml') return res.setHeader('Content-Type', 'application/xml; charset=utf-8').send(req.method === 'HEAD' ? '' : renderSitemap(catalog.products));
    const product = path === '/' ? undefined : productFromPath(path, catalog.products);
    if (path !== '/' && !product) return res.status(404).setHeader('Cache-Control', 'no-store').send('Bó hoa này hiện không được bán.');
    const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(req.method === 'HEAD' ? '' : renderStorefront({ template, ...catalog, product, preview }));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    return res.status(503).send('Đang kết nối bộ sưu tập hoa. Vui lòng tải lại sau ít phút.');
  }
}
