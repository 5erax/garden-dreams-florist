import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { deliveryCopy } from '../src/delivery-copy.js';
import { quickViewUrl, quickViewFromUrl } from '../src/quick-view.js';
import { watchHistoryUpdates } from '../src/customer-history.js';
import { matchesFlowerDescription } from '../src/flower-selection.js';
let server, FlowerCard, Garden, PortalShell, ShopHeader;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite/tests/shopping-polish', import.meta.url)),
    plugins: [{ name: 'shopping-polish-fixture', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/Store.jsx')) return 'export const useStore=()=>globalThis.shoppingFixture;'; } }, react()],
    define: { 'import.meta.env.VITE_APP_ENV': '"demo"', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  ({ default: FlowerCard } = await server.ssrLoadModule('/src/FlowerCard.jsx'));
  ({ default: Garden } = await server.ssrLoadModule('/src/Garden.jsx'));
  ({ PortalShell } = await server.ssrLoadModule('/src/PortalShell.jsx'));
  ({ default: ShopHeader } = await server.ssrLoadModule('/src/ShopHeader.jsx'));
});
after(async () => { await server?.close(); delete globalThis.shoppingFixture; delete globalThis.location; });
const flower = { id: 1, slug: 'bo-hoa-1', name: 'Má hồng', stems: 'Hồng phấn, hoa phụ', price: 550000, image: '/flowers/bouquet_7.webp', active: true };
const card = product => renderToStaticMarkup(createElement(FlowerCard, { product, tone: 0, onView() {}, onAdd() {}, onFavorite() {}, onCompare() {} }));
test('purchase is outside the image with explicit actions; unavailable cards cannot add and comparison is secondary', () => {
  const html = card(flower);
  assert.ok(html.indexOf('product-card-actions') > html.indexOf('product-copy'));
  assert.match(html, /Thêm vào giỏ hoa/); assert.doesNotMatch(html, /quick-add/);
  assert.match(html, /type="checkbox"/); assert.match(html, /hoa nhỏ phối cùng/);
  assert.doesNotMatch(html, /class="button outline card-add" disabled/);
  const reference = card({ ...flower, active: false, reference_only: true });
  assert.match(reference, /Chưa nhận đặt/); assert.match(reference, /class="button outline card-add" disabled=""/);
  assert.match(reference, /Xem mẫu hoa/);
});
test('garden with no public messages hides zero counter and has an immediate way to choose flowers', () => {
  globalThis.shoppingFixture = { connected: false };
  const html = renderToStaticMarkup(createElement(Garden));
  assert.doesNotMatch(html, /garden-count|A GARDEN OF WORDS/);
  assert.match(html, /garden-first/); assert.match(html, /href="\/#collection"/);
});
test('account shell keeps consistent navigation, active page, cart and contact links', () => {
  globalThis.location = { pathname:'/', hash: '#garden' };
  globalThis.shoppingFixture = { shop: { name: 'Garden Dreams', phone: '0832345780' }, session: { user: { id: 'alice' } }, isAdmin: false };
  const header = createElement(ShopHeader, { route:'#garden',cartCount:2,onCart(){},onFavorites(){},onlyFavorites:false });
  const html = renderToStaticMarkup(createElement(PortalShell, { header }));
  assert.match(html, /Bộ sưu tập/); assert.match(html, /Đặt &amp; giao hoa/);
  assert.match(html, /href="#garden"[^>]*aria-current="page"/);
  assert.match(html, /Mở giỏ hoa, 2 bó/); assert.match(html, /class="portal-signout"/);
  assert.match(html, /tel:0832345780/); assert.match(html, /zalo.me\/0832345780/);
});
test('quick view URLs preserve query/hash and resolve known products only, supporting Back restoration', () => {
  const href = quickViewUrl('https://example.test/?nocache=1#collection', flower);
  assert.equal(href, '/?nocache=1&flower=bo-hoa-1#collection');
  assert.equal(quickViewFromUrl('?flower=bo-hoa-1', [flower]), flower);
  assert.equal(quickViewFromUrl('?flower=unknown', [flower]), null);
  assert.equal(quickViewUrl('https://example.test' + href, null), '/?nocache=1#collection');
});
test('flower filters distinguish rose species from pink coloring instead of matching every occurrence of hồng', () => {
  assert.equal(matchesFlowerDescription({ stems: 'Hồng đỏ, giấy vintage' }, 'hồng', ''), false);
  assert.equal(matchesFlowerDescription({ stems: 'Hồng đỏ, giấy vintage' }, 'đỏ', 'hồng'), true);
  assert.equal(matchesFlowerDescription({ stems: 'Mẫu đơn hồng' }, 'hồng', 'hồng'), false);
  assert.equal(matchesFlowerDescription({ stems: 'Mẫu đơn hồng' }, 'hồng', 'mẫu đơn'), true);
  assert.equal(matchesFlowerDescription({ stems: 'Hồng phấn' }, 'hồng', 'hồng'), true);
  assert.equal(matchesFlowerDescription({ stems: 'Cẩm tú cầu xanh' }, 'xanh', 'cẩm tú cầu'), true);
});
test('delivery copy uses configured zones and exact fees instead of a universal free-shipping claim', () => {
  assert.match(deliveryCopy(), /30.000/); assert.match(deliveryCopy(), /50.000/);
  assert.equal(deliveryCopy([{ name: 'Long Thành', fee: 10000 }]), 'Long Thành: 10.000 ₫');
});
test('secondary shopping text and accent meet AA against the actual paper and finder backgrounds', async () => {
  const css = await readFile(new URL('../src/shopping-polish.css', import.meta.url), 'utf8');
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const foreground of ['#65514b', '#85425e']) {
    assert.ok(css.includes(foreground));
    for (const background of ['#fffaf6', '#efe8df']) assert.ok((luminance(background) + .05) / (luminance(foreground) + .05) >= 4.5);
  }
});
test('history refresh pauses in hidden tabs and removes timer/listener on leaving the account', t => {
  let count = 0, listener;
  globalThis.document = { visibilityState: 'visible', addEventListener(name, fn) { listener = fn; }, removeEventListener(name, fn) { assert.equal(fn, listener); listener = null; } };
  t.mock.timers.enable({ apis: ['setInterval'] });
  try {
    const stop = watchHistoryUpdates(() => count++);
    t.mock.timers.tick(60000); assert.equal(count, 1);
    globalThis.document.visibilityState = 'hidden'; t.mock.timers.tick(60000); assert.equal(count, 1);
    globalThis.document.visibilityState = 'visible'; listener(); assert.equal(count, 2);
    stop(); t.mock.timers.tick(60000); assert.equal(count, 2); assert.equal(listener, null);
  } finally { delete globalThis.document; }
});
