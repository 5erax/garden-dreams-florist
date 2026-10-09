import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCart,
  subtotal,
  validateOrder,
  vietnamDate,
} from "../src/order.js";
import handler from "../api/orders.js";

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

function response() {
  return {
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
test("API refuses other methods, foreign origins, malformed origins, and non-JSON requests", async () => {
  for (const [req, code] of [
    [{ method: "GET", headers: {} }, 405],
    [
      {
        method: "POST",
        headers: { origin: "https://other.example", host: "shop.example" },
      },
      403,
    ],
    [
      { method: "POST", headers: { origin: "invalid", host: "shop.example" } },
      403,
    ],
    [{ method: "POST", headers: {} }, 415],
    [
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "17000",
        },
      },
      413,
    ],
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.code, code);
  }
});
test("demo API does not claim to accept or store an order", async () => {
  const previous = process.env.SHOP_ORDERS_ENABLED;
  delete process.env.SHOP_ORDERS_ENABLED;
  try {
    const res = response();
    await handler(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: input,
      },
      res,
    );
    assert.equal(res.code, 503);
    assert.match(res.body.error, /chưa được gửi/);
    assert.equal(res.body.received, undefined);
  } finally {
    if (previous === undefined) delete process.env.SHOP_ORDERS_ENABLED;
    else process.env.SHOP_ORDERS_ENABLED = previous;
  }
});
