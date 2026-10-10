import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCart,
  subtotal,
  validateOrder,
  vietnamDate,
} from "../src/order.js";


const now = new Date("2026-10-09T03:00:00Z");
const input = {
  requestId: "a488624e-b819-4863-9b99-1efc333a5417",
  name: "Khách thử nghiệm",
  phone: "0900000000",
  address: "Địa chỉ kiểm thử, không giao hoa",
  message: "Đây là dữ liệu kiểm thử.",
  items: [{ id: 1, quantity: 2 }],
  deliveryDate: "2026-10-10",
  deliveryTime: "Chiều · 13–17h",
  consent: true,
};

test("uses catalog prices, computes whole VND totals, and ignores client totals", () => {
  const order = validateOrder(
    { ...input, subtotal: 1, items: [{ id: 1, quantity: 2, price: 1 }] },
    now,
  );
  assert.equal(order.subtotal, 780000);
  assert.equal(order.items[0].price, 390000);
  assert.equal(order.payment, "COD");
});
test("restored cart drops invalid products and quantities, merges duplicates, and caps quantity", () => {
  assert.deepEqual(
    normalizeCart([
      { id: 1, quantity: 19 },
      { id: 1, quantity: 3 },
      { id: 99, quantity: 1 },
      { id: 2, quantity: -1 },
      { id: 3, quantity: 1.5 },
      null,
    ]),
    [{ id: 1, quantity: 20 }],
  );
  assert.deepEqual(normalizeCart({}), []);
  assert.equal(
    subtotal([
      { id: 1, quantity: 2 },
      { id: 2, quantity: 1 },
    ]),
    1270000,
  );
});
test("delivery dates use Vietnam time even across a UTC midnight boundary", () => {
  assert.equal(vietnamDate(new Date("2026-10-09T18:00:00Z")), "2026-10-10");
});
test("rejects impossible, past, and distant dates", () => {
  for (const deliveryDate of [
    "2026-02-30",
    "2026-10-08",
    "2027-04-10",
    "not-a-date",
  ])
    assert.throws(
      () => validateOrder({ ...input, deliveryDate }, now),
      /ngày nhận/,
    );
});
test("rejects missing consent, bad contacts, duplicate or unknown items, and unsafe quantities", () => {
  for (const invalid of [
    { consent: false },
    { phone: "12345" },
    { name: " " },
    { address: "ngắn" },
    { items: [] },
    { items: [{ id: 99, quantity: 1 }] },
    { items: [{ id: 1, quantity: 0 }] },
    { items: [{ id: 1, quantity: 1.1 }] },
    { items: [{ id: 1, quantity: 21 }] },
    {
      items: [
        { id: 1, quantity: 1 },
        { id: 1, quantity: 1 },
      ],
    },
    { requestId: "../../private" },
    { message: "x".repeat(501) },
    { deliveryTime: "unknown" },
  ])
    assert.throws(() => validateOrder({ ...input, ...invalid }, now));
});
test("accepts the Vietnam +84 format and trims submitted text", () => {
  const order = validateOrder(
    { ...input, phone: "+84 900 000 000", name: "  Khách thử nghiệm  " },
    now,
  );
  assert.equal(order.phone, "+84900000000");
  assert.equal(order.name, "Khách thử nghiệm");
});

test("cart keeps sizes separate, calculates catalog prices and drops unavailable sizes without substituting", () => {
  const catalog = [{ id: 1, name: "Hoa thử", price: 390000, variants: [
    { id: 101, size_name: "Bó lớn", sku: "TEST-L", price: 700000, active: true },
    { id: 102, size_name: "Bó vừa", sku: "TEST-M", price: 500000, active: true },
    { id: 103, size_name: "Cỡ tắt", price: 1000000, active: false },
  ] }];
  const cart = normalizeCart([{ id: 1, quantity: 1 }, { id: 1, variantId: 101, quantity: 1, price: 1 },
    { id: 1, variantId: 101, quantity: 2 }, { id: 1, variantId: 102, quantity: 1 },
    { id: 1, variantId: 103, quantity: 1 }, { id: 1, variantId: "101", quantity: 1 },
    { id: 1, variantId: 999, quantity: 1 }], catalog);
  assert.deepEqual(cart, [{ id: 1, quantity: 1 }, { id: 1, variantId: 101, quantity: 3 }, { id: 1, variantId: 102, quantity: 1 }]);
  assert.equal(subtotal(cart, catalog), 2990000);
  const order = validateOrder({ ...input, items: cart }, now, catalog);
  assert.equal(order.items[1].price, 700000);
  assert.equal(order.items[1].sizeName, "Bó lớn");
  assert.equal(order.items[1].sku, "TEST-L");
  for (const items of [[{ id: 1, variantId: 103, quantity: 1 }], [{ id: 1, variantId: 999, quantity: 1 }],
    [{ id: 1, variantId: 101, quantity: 1 }, { id: 1, variantId: 101, quantity: 2 }]])
    assert.throws(() => validateOrder({ ...input, items }, now, catalog), /Số lượng/);
  assert.deepEqual(normalizeCart(cart, [{ ...catalog[0], variants: [] }]), [{ id: 1, quantity: 1 }]);
});
