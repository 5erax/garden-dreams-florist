import { test } from "node:test";
import assert from "node:assert/strict";
import { sendCheckout } from "../src/checkout-request.js";
import { removeOrderedItems } from "../src/order.js";

const request = { requestId: "original", expectedTotal: 390000, items: [{ id: 1, quantity: 1 }], message: "Lời thương" };
test("lost acknowledgement retries exactly the same request after reopening or editing the cart", async () => {
  const pending = { current: null };
  let saved;
  await assert.rejects(sendCheckout(pending, "alice", request, async payload => {
    saved = payload;
    throw new TypeError("Failed to fetch");
  }));
  const response = await sendCheckout(pending, "alice", { ...request, requestId: "new", message: "changed" }, async payload => {
    assert.deepEqual(payload, saved);
    return { id: payload.requestId, total: payload.expectedTotal };
  });
  assert.equal(response.order.id, "original");
  assert.equal(response.request, request);
  assert.equal(pending.current, null);
});
test("SQL rejection permits editing and a new submission, but idempotency conflict remains recoverable", async () => {
  const pending = { current: null };
  for (const cause of [{ code: "P0001", message: "PRICE_CHANGED" }, { code: "22P02" }, { code: "42501" }]) {
    await assert.rejects(sendCheckout(pending, "alice", request, async () => { throw new Error("rejected", { cause }); }));
    assert.equal(pending.current, null);
  }
  await assert.rejects(sendCheckout(pending, "alice", request, async () => {
    throw new Error("conflict", { cause: { code: "P0001", message: "IDEMPOTENCY_CONFLICT" } });
  }));
  assert.equal(pending.current.request, request);
});
test("another customer never retries the previous customer's private request", async () => {
  const pending = { current: { ownerId: "alice", request } };
  const own = { ...request, requestId: "bob", message: "Private Bob" };
  const response = await sendCheckout(pending, "bob", own, async payload => {
    assert.equal(payload, own);
    return { id: "bob" };
  });
  assert.equal(response.request, own);
});
test("logout during submission prevents completion into another session", async () => {
  const pending = { current: null };
  await assert.rejects(sendCheckout(pending, "alice", request, async () => {
    pending.current = null;
    return { id: "original" };
  }), /Phiên đăng nhập đã đổi/);
});
test("recovering an earlier order preserves flowers subsequently added to the cart", () => {
  assert.deepEqual(removeOrderedItems([{ id: 1, quantity: 3 }, { id: 2, quantity: 1 }], request.items), [
    { id: 1, quantity: 2 }, { id: 2, quantity: 1 },
  ]);
  assert.deepEqual(removeOrderedItems([{ id: 1, quantity: 1 }], [{ id: 1, quantity: 2 }]), []);
  const catalog = [{ id: 1, price: 390000, variants: [{ id: 101, price: 700000, active: true }] }];
  assert.deepEqual(removeOrderedItems([{ id: 1, quantity: 1 }, { id: 1, variantId: 101, quantity: 1 }], request.items, catalog), [{ id: 1, variantId: 101, quantity: 1 }]);
});
