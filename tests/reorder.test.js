import test from "node:test";
import assert from "node:assert/strict";
import { prepareReorder } from "../src/reorder.js";
import { normalizeCart, cartKey } from "../src/order.js";

const products = [
  { id: 1, name: "Khúc hồng mới", price: 490000, image: "/flowers/rose.webp", active: true,
    variants: [
      { id: 11, product_id: 1, price: 650000, size_name: "Lớn", sku: "ROSE-L", active: true },
      { id: 12, product_id: 1, price: 390000, size_name: "Nhỏ", sku: "ROSE-S", active: false },
    ] },
  { id: 2, name: "Nắng dịu", price: 390000, active: true, variants: [
    { id: 21, product_id: 2, price: 590000, size_name: "Lớn", sku: "DAISY-L", active: true },
  ] },
  { id: 3, name: "Hoa đã ngừng bán", price: 100000, active: false },
];
const item = (id, extra = {}) => ({ id, name: "Tên trong đơn cũ", price: 1, quantity: 2, ...extra });

test("reorder of base legacy snapshots uses today's name, price and image without historical payment or shipping", () => {
  const result = prepareReorder([item(1, { variantId: null, sizeName: "Tên cỡ cũ" })], [], products);
  assert.deepEqual(result.cart, [{ id: 1, quantity: 2 }]);
  assert.equal(result.lines[0].name, "Khúc hồng mới");
  assert.equal(result.lines[0].image, "/flowers/rose.webp");
  assert.equal(result.lines[0].sizeName, "");
  assert.equal(result.lines[0].price, 490000);
  assert.equal(result.addedQuantity, 2);
  assert.equal(result.total, 980000);
  assert.equal(result.unavailable.length, 0);
});

test("reorder retains an available exact variant and prices its current catalog snapshot", () => {
  const result = prepareReorder([item(1, { variantId: 11, sizeName: "Cỡ cũ", sku: "OLD", quantity: 3 })], [], products);
  assert.deepEqual(result.cart, [{ id: 1, variantId: 11, quantity: 3 }]);
  assert.equal(result.lines[0].sizeName, "Lớn");
  assert.equal(result.lines[0].sku, "ROSE-L");
  assert.equal(result.lines[0].price, 650000);
  assert.equal(result.total, 1950000);
});

test("removed, foreign and inactive variants never fall back to a base bouquet", () => {
  const result = prepareReorder([
    item(1, { variantId: 999, sizeName: "Cỡ đã xóa" }),
    item(1, { variantId: 21 }),
    item(1, { variantId: 12 }),
  ], [], products);
  assert.deepEqual(result.cart, []);
  assert.equal(result.lines.length, 0);
  assert.equal(result.addedQuantity, 0);
  assert.equal(result.total, 0);
  assert.deepEqual(result.unavailable.map(line => line.reason), ["VARIANT_UNAVAILABLE", "VARIANT_UNAVAILABLE", "VARIANT_UNAVAILABLE"]);
  assert.equal(result.unavailable[0].sizeName, "Cỡ đã xóa");
});

test("partially available orders add available bouquets and label every unavailable product", () => {
  const result = prepareReorder([item(1), item(3), item(999, { name: "Mẫu không còn" })], [], products);
  assert.deepEqual(result.cart, [{ id: 1, quantity: 2 }]);
  assert.equal(result.addedQuantity, 2);
  assert.deepEqual(result.unavailable.map(line => line.reason), ["PRODUCT_UNAVAILABLE", "PRODUCT_UNAVAILABLE"]);
  assert.equal(result.unavailable[1].name, "Mẫu không còn");
});

test("existing cart survives reorder; added-only subtotal excludes its original contents", () => {
  const cart = [{ id: 2, variantId: 21, quantity: 3 }, { id: 1, quantity: 4 }];
  const result = prepareReorder([item(1)], cart, products);
  assert.deepEqual(result.cart, [{ id: 2, variantId: 21, quantity: 3 }, { id: 1, quantity: 6 }]);
  assert.equal(result.lines[0].existingQuantity, 4);
  assert.equal(result.lines[0].addedQuantity, 2);
  assert.equal(result.total, 980000);
});

test("quantity cap adds only remaining capacity and does not reduce a full existing line", () => {
  const result = prepareReorder([item(1, { quantity: 8 })], [{ id: 1, quantity: 17 }], products);
  assert.deepEqual(result.cart, [{ id: 1, quantity: 20 }]);
  assert.equal(result.lines[0].quantity, 8);
  assert.equal(result.lines[0].addedQuantity, 3);
  assert.equal(result.lines[0].reason, "QUANTITY_LIMIT");
  assert.equal(result.total, 1470000);
  const full = prepareReorder([item(1)], [{ id: 1, quantity: 20 }], products);
  assert.deepEqual(full.cart, [{ id: 1, quantity: 20 }]);
  assert.equal(full.addedQuantity, 0);
  assert.equal(full.total, 0);
});

test("base and variant are distinct house cart keys while duplicate requests merge transparently", () => {
  const result = prepareReorder([item(1, { quantity: 15 }), item(1, { quantity: 15 }), item(1, { variantId: 11, quantity: 1 })], [], products);
  assert.deepEqual(result.cart, [{ id: 1, quantity: 20 }, { id: 1, variantId: 11, quantity: 1 }]);
  assert.equal(result.lines[0].quantity, 30);
  assert.equal(result.lines[0].addedQuantity, 20);
  assert.equal(result.lines[0].reason, "QUANTITY_LIMIT");
  assert.equal(result.addedQuantity, 21);
  assert.equal(new Set(result.cart.map(cartKey)).size, 2);
});

test("20 unique cart lines block only new choices; existing choices can still gain quantity", () => {
  const catalog = Array.from({ length: 22 }, (_, index) => ({ id: index + 1, name: `Mẫu ${index + 1}`, price: 100000, active: true }));
  const cart = catalog.slice(0, 20).map(product => ({ id: product.id, quantity: 1 }));
  const result = prepareReorder([item(21), item(1), item(22)], cart, catalog);
  assert.equal(result.cart.length, 20);
  assert.equal(result.cart[0].quantity, 3);
  assert.equal(result.addedQuantity, 2);
  assert.equal(result.total, 200000);
  assert.deepEqual(result.lines.map(line => line.reason), ["CART_LINE_LIMIT", null, "CART_LINE_LIMIT"]);
});

test("an over-limit legacy cart is preserved instead of silently truncating existing selections", () => {
  const catalog = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, name: `Mẫu ${index + 1}`, price: 100000, active: true }));
  const cart = catalog.map(product => ({ id: product.id, quantity: 1 }));
  const result = prepareReorder([item(1)], cart, catalog);
  assert.deepEqual(result.cart, cart);
  assert.equal(result.addedQuantity, 0);
  assert.equal(result.total, 0);
  assert.equal(result.lines[0].reason, "CART_LINE_LIMIT");
});

test("malformed snapshots cannot introduce identifiers, quantities or prices into the cart", () => {
  const bad = [null, "flower", item("1"), item(-1), item(1, { variantId: "11" }), item(1, { quantity: 0 }), item(1, { quantity: 1.5 }), item(1, { quantity: 21 }), item(1, { quantity: Infinity })];
  const result = prepareReorder(bad, [{ id: 2, quantity: 1 }], products);
  assert.deepEqual(result.cart, [{ id: 2, quantity: 1 }]);
  assert.equal(result.unavailable.length, bad.length);
  assert.equal(result.addedQuantity, 0);
  const invalid = prepareReorder({}, [{ id: 2, quantity: 1 }], products);
  assert.deepEqual(invalid.cart, [{ id: 2, quantity: 1 }]);
  assert.equal(invalid.unavailable[0].reason, "INVALID_ITEMS");
  assert.deepEqual(prepareReorder([], [{ id: 2, quantity: 1 }], products).cart, [{ id: 2, quantity: 1 }]);
});

test("only canonical product choices reach merged cart; order snapshots, products and original cart stay unchanged", () => {
  const items = [item(1, { card_message: "private-card-secret", recipient_name: "private-name-secret", recipient_phone: "private-phone-secret", address: "private-address-secret", bank: { account: "private-bank-secret" } })];
  const cart = [{ id: 2, quantity: 1, recipient_phone: "cart-phone-secret" }];
  const originals = structuredClone({ items, cart, products });
  const result = prepareReorder(items, cart, products);
  assert.deepEqual({ items, cart, products }, originals);
  assert.deepEqual(result.cart, [{ id: 2, quantity: 1 }, { id: 1, quantity: 2 }]);
  const serialized = JSON.stringify(result);
  for (const secret of ["private-card-secret", "private-name-secret", "private-phone-secret", "private-address-secret", "private-bank-secret", "cart-phone-secret"]) assert.equal(serialized.includes(secret), false);
  assert.deepEqual(normalizeCart(result.cart, products), result.cart);
});

test("current malformed currency is blocked even if the old order had a valid price", () => {
  for (const price of [NaN, Infinity, -1, 0.5, "490000", Number.MAX_SAFE_INTEGER]) {
    const result = prepareReorder([item(1, { price: 490000 })], [], [{ ...products[0], price }]);
    assert.equal(result.unavailable[0].reason, "PRICE_UNAVAILABLE");
    assert.equal(result.total, 0);
    assert.deepEqual(result.cart, []);
  }
});
