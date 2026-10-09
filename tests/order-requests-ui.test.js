import { test } from "node:test";
import assert from "node:assert/strict";
import { canRequestChange, prepareOrderRequest, requestStatuses } from "../src/order-requests.js";
import { sendCheckout } from "../src/checkout-request.js";

const id = "d2320c25-0928-465d-9e8c-30316b7b0fcd";
const order = { id: "order-a", version: 7, status: "PENDING", address: "665L, Long Phước, Long Thành", total: 600000, shipping: { id: "zone-a" } };
const fields = { name: "  Hà Văn Phước  ", phone: "083 234 5780", address: order.address, reason: "  Đổi người nhận giúp tôi  " };

test("contact requests normalize fields and never carry delivery or money modifications", () => {
  const args = prepareOrderRequest(order, "CONTACT", { ...fields, total: 0, shipping: {}, delivery_date: "2026-10-20", card_message: "rewrite" }, id);
  assert.deepEqual(args, {
    p_id: id, p_order: "order-a", p_version: 7, p_kind: "CONTACT",
    p_body: { reason: "Đổi người nhận giúp tôi", name: "Hà Văn Phước", phone: "0832345780", address: "665L, Long Phước, Long Thành" },
  });
  assert.equal(order.total, 600000);
});

test("cancel request only carries its reason and does not pretend to cancel an order", () => {
  const args = prepareOrderRequest(order, "CANCEL", fields, id);
  assert.deepEqual(args.p_body, { reason: "Đổi người nhận giúp tôi" });
  assert.equal(order.status, "PENDING");
  assert.equal(requestStatuses.OPEN, "Đang chờ cửa hàng");
  assert.equal(requestStatuses.ACCEPTED, "Đã chấp thuận");
});

test("only pending or confirmed orders with retained contacts accept change requests", () => {
  for (const status of ["PENDING", "CONFIRMED"]) assert.equal(canRequestChange({ ...order, status }), true);
  for (const status of ["PREPARING", "SHIPPING", "DELIVERED", "CANCELLED", "UNKNOWN", null]) {
    assert.equal(canRequestChange({ ...order, status }), false);
    assert.throws(() => prepareOrderRequest({ ...order, status }, "CANCEL", fields, id), /không còn/);
  }
  assert.equal(canRequestChange({ ...order, contacts_erased_at: "2026-10-10T00:00:00Z" }), false);
});

test("request preparation rejects invalid Vietnamese phones, lengths, IDs, kinds and control characters", () => {
  for (const phone of ["12345", "0192345678", "+4412345678", "08323457801", "<b>0832345780</b>"]) {
    assert.throws(() => prepareOrderRequest(order, "CONTACT", { ...fields, phone }, id), /điện thoại/);
  }
  assert.equal(prepareOrderRequest(order, "CONTACT", { ...fields, phone: "+84 (83) 234-5780" }, id).p_body.phone, "+84832345780");
  for (const invalid of [{ name: "A" }, { reason: "ok" }, { reason: "x".repeat(501) }, { name: "Hà\u0001 Phước" }]) {
    assert.throws(() => prepareOrderRequest(order, "CONTACT", { ...fields, ...invalid }, id), /Kiểm tra/);
  }
  assert.throws(() => prepareOrderRequest(order, "RESCHEDULE", fields, id), /loại yêu cầu/);
  assert.throws(() => prepareOrderRequest(order, "toString", fields, id), /loại yêu cầu/);
  assert.throws(() => prepareOrderRequest(order, "CANCEL", fields, "invalid"), /Mã yêu cầu/);
});

test("contact correction keeps the exact order address and rejects address changes requiring a new delivery quote", () => {
  for (const address of ["100, Biên Hòa, Đồng Nai", "Short", `${order.address} `, null, { city: "Đồng Nai" }]) {
    assert.throws(() => prepareOrderRequest(order, "CONTACT", { ...fields, address }, id), /báo lại phí và lịch giao/);
  }
  const { address: omitted, ...nameAndPhone } = fields;
  assert.equal(prepareOrderRequest(order, "CONTACT", nameAndPhone, id).p_body.address, order.address);
  for (const address of ["", null, "Short", "x".repeat(301), "665L, Long Phước\u0001"]) {
    assert.throws(() => prepareOrderRequest({ ...order, address }, "CONTACT", { ...nameAndPhone }, id), /Địa chỉ đã lưu/);
  }
});

test("a lost acknowledgement retries the same contact snapshot instead of applying edited form values", async () => {
  const pending = { current: null };
  const intent = { rpc: "gd_request_order_change", args: prepareOrderRequest(order, "CONTACT", fields, id) };
  const saved = structuredClone(intent);
  await assert.rejects(sendCheckout(pending, "alice", intent, async () => { throw new TypeError("Connection lost after save"); }));
  const edited = { rpc: "gd_request_order_change", args: prepareOrderRequest(order, "CANCEL", { reason: "Giờ tôi muốn hủy" }, "05425d58-e21c-4b9e-ad88-a8a6704b9faa") };
  const response = await sendCheckout(pending, "alice", edited, async payload => {
    assert.deepEqual(payload, saved);
    return { id, status: "OPEN" };
  });
  assert.equal(response.order.status, "OPEN");
  assert.equal(pending.current, null);
});

test("admin decisions preserve the chosen response after an ambiguous failure and discard definitive conflicts", async () => {
  const pending = { current: null };
  const decision = { rpc: "gd_resolve_order_request", args: { p_id: id, p_version: 3, p_accept: true, p_response: "Shop đã kiểm tra và đồng ý hủy đơn." } };
  await assert.rejects(sendCheckout(pending, "admin", decision, async () => { throw new TypeError("Timeout"); }));
  assert.equal(pending.current.request, decision);
  await assert.rejects(sendCheckout(pending, "admin", { ...decision, args: { ...decision.args, p_accept: false } }, async payload => {
    assert.equal(payload.args.p_accept, true);
    throw new Error("Đã được xử lý", { cause: { code: "P0001", message: "VERSION_CONFLICT" } });
  }));
  assert.equal(pending.current, null);
});

test("another account cannot reuse a frozen request carrying a prior customer's address", async () => {
  const pending = { current: { ownerId: "alice", request: { rpc: "gd_request_order_change", args: prepareOrderRequest(order, "CONTACT", fields, id) } } };
  const own = { rpc: "gd_request_order_change", args: prepareOrderRequest({ ...order, id: "bob-order" }, "CANCEL", { reason: "Tôi cần hủy đơn này" }, id) };
  await sendCheckout(pending, "bob", own, async payload => {
    assert.equal(payload, own);
    assert.equal(payload.args.p_body.address, undefined);
    return { status: "OPEN" };
  });
});
