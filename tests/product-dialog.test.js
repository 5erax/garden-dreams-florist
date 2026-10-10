import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { products, money } from "../src/catalog.js";

let server, ProductDialog;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    cacheDir: fileURLToPath(new URL("../node_modules/.vite/tests/product-dialog", import.meta.url)),
    configFile: false,
    envDir: false,
    plugins: [react()],
    define: {
      "import.meta.env.VITE_APP_ENV": JSON.stringify("demo"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
    },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ ProductDialog } = await server.ssrLoadModule("/src/ShopDialogs.jsx"));
});
after(async () => { await server?.close(); });

const render = product => renderToStaticMarkup(createElement(ProductDialog, {
  product, onClose() {}, onAdd() {}, onBuy() {}, favorite: false, onFavorite() {},
}));

test("a cold product snapshot without occasion renders instead of crashing", () => {
  const { occasion, ...snapshot } = products[0];
  const html = renderToStaticMarkup(createElement(ProductDialog, {
    product: snapshot, inline: true, onAdd() {}, onBuy() {}, onFavorite() {},
  }));
  assert.match(html, /người bạn thương/);
  assert.match(html, /id="buy"/);
  assert.match(html, /Thêm vào giỏ/);
});

test("reference products disclose proposed pricing and cannot enter checkout", () => {
  const html = render({ ...products[0], active: false, reference_only: true });
  assert.match(html, /Mẫu tham khảo/);
  assert.match(html, /Giá dự kiến/);
  assert.match(html, /class="button primary" disabled=""/);
  assert.doesNotMatch(html, /Cỡ này đã ngừng/);
});

test("product detail identifies the standard size and subtotal before adding", () => {
  const html = render(products[0]);
  assert.match(html, /Tạm tính/);
  assert.match(html, /1 bó · Tiêu chuẩn/);
  assert.ok(html.includes(money(products[0].price)));
  assert.match(html, /Chưa gồm phí giao hoa/);
  assert.match(html, /Thêm &amp; đặt ngay/);
  assert.doesNotMatch(html, /class="button primary" disabled/);
});

test("unavailable product shows no fallback price or subtotal and cannot be added", () => {
  const html = render({ ...products[0], active: false });
  assert.doesNotMatch(html, /Tạm tính/);
  assert.ok(!html.includes(money(products[0].price)));
  assert.match(html, /role="alert"/);
  assert.match(html, /class="button primary" disabled=""/);
});

test("additional sizes keep Standard selected in the accessible size control", () => {
  const html = render({ ...products[0], variants: [
    { id: 101, active: true, size_name: "Bó lớn", price: 700000, sku: "TEST-L" },
  ] });
  assert.match(html, /Cỡ bó hoa/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /name="variantId"[^>]*value=""/);
  assert.ok(html.includes(`Tiêu chuẩn · ${money(products[0].price)}`));
  assert.match(html, /1 bó · Tiêu chuẩn/);
});
