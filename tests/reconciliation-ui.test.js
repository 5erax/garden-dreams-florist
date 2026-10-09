import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedReconciliationActions, prepareReconciliation, validatePaymentBalance } from "../src/reconciliation.js";
import { sendCheckout } from "../src/checkout-request.js";

const id = "a60363c7-130b-4306-af3d-b27a0b3cc6e6";
const order = { id: "order-a", version: 4, status: "DELIVERED", payment_status: "UNPAID", payment_method: "COD", total: 390000 };
const unpaid = { orderId: order.id, total: order.total, received: 0, refunded: 0, heldCash: 0, receivable: order.total, refundable: 0, legacyBalance: false, fullOnly: true };
const paid = { ...unpaid, received: order.total, heldCash: order.total, receivable: 0, refundable: order.total };
const refunded = { ...paid, refunded: order.total, heldCash: 0, refundable: 0 };
const fields = { action: "RECEIPT", checked: true, evidence: "  Đã kiểm tra tiền COD nhận đủ  ", reference: "  COD/CA_1-02.03  " };

test("delivered COD remains receivable until a checked receipt is recorded", () => {
  assert.deepEqual(allowedReconciliationActions(order, unpaid), ["RECEIPT"]);
  assert.equal(unpaid.received, 0);
  assert.equal(unpaid.heldCash, 0);
  for (const status of ["PENDING", "CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"])
    assert.deepEqual(allowedReconciliationActions({ ...order, status }, unpaid), ["RECEIPT"]);
  assert.deepEqual(allowedReconciliationActions({ ...order, status: "CANCELLED" }, { ...unpaid, receivable: 0 }), []);
  assert.deepEqual(allowedReconciliationActions({ ...order, status: "UNKNOWN" }, unpaid), []);
});

test("paid cancellation can record one full refund, while refunded and partially accounted balances stay blocked", () => {
  assert.deepEqual(allowedReconciliationActions({ ...order, status: "CANCELLED", payment_status: "PAID" }, paid), ["REFUND"]);
  assert.deepEqual(allowedReconciliationActions({ ...order, payment_status: "REFUNDED" }, refunded), []);
  assert.deepEqual(allowedReconciliationActions({ ...order, payment_status: "PAID" }, { ...paid, refunded: 10000, heldCash: 380000, refundable: 380000 }), []);
  assert.deepEqual(allowedReconciliationActions({ ...order, payment_status: "PAID" }, { ...paid, legacyBalance: true }), ["REFUND"]);
  assert.deepEqual(allowedReconciliationActions(order, { ...unpaid, fullOnly: false }), []);
  assert.deepEqual(allowedReconciliationActions({ ...order, total: 0 }, { ...unpaid, total: 0, receivable: 0 }), []);
});

test("full receipt sends operation identity, snapshot version and evidence, never a client amount", () => {
  const args = prepareReconciliation(order, unpaid, { ...fields, amount: 1, total: 1, payment_status: "PAID", actor_id: "fake" }, id);
  assert.deepEqual(args, { p_id: id, p_order: order.id, p_version: 4, p_action: "RECEIPT", p_evidence: "Đã kiểm tra tiền COD nhận đủ", p_reference: "COD/CA_1-02.03" });
  assert.equal(order.payment_status, "UNPAID");
  assert.equal(unpaid.received, 0);
});

test("proof and explicit external-payment confirmation are required for either action", () => {
  for (const checked of [false, undefined, "on", 1])
    assert.throws(() => prepareReconciliation(order, unpaid, { ...fields, checked }, id), /Xác nhận/);
  for (const evidence of ["ok", "x".repeat(501), "Proof\u0001bad", undefined])
    assert.throws(() => prepareReconciliation(order, unpaid, { ...fields, evidence }, id), /5 đến 500/);
  for (const reference of ["Mã ngân hàng", "id@MB", "id:123", "x".repeat(121), "<script>"])
    assert.throws(() => prepareReconciliation(order, unpaid, { ...fields, reference }, id), /Tham chiếu/);
  assert.equal(prepareReconciliation(order, unpaid, { ...fields, reference: "" }, id).p_reference, "");
  const refund = prepareReconciliation({ ...order, payment_status: "PAID" }, paid, { ...fields, action: "REFUND" }, id);
  assert.equal(refund.p_action, "REFUND");
  assert.throws(() => prepareReconciliation(order, unpaid, { ...fields, action: "REFUND" }, id), /chưa khả dụng/);
  assert.throws(() => prepareReconciliation(order, unpaid, fields, "invalid"), /Mã thao tác/);
});

test("invalid or mismatched server balances are errors rather than invented zero money", () => {
  assert.equal(validatePaymentBalance(paid, order.id), paid);
  for (const invalid of [null, { ...paid, orderId: "another-order" }, { ...paid, total: "390000" }, { ...paid, received: Number.NaN }, { ...paid, refunded: -1 }, { ...paid, heldCash: 0 }, { ...paid, refundable: 400000 }, { ...paid, receivable: 400000 }, { ...paid, total: Number.MAX_SAFE_INTEGER + 1 }, { ...paid, legacyBalance: undefined }])
    assert.throws(() => validatePaymentBalance(invalid, order.id), /Số dư trả về/);
  assert.deepEqual(allowedReconciliationActions(order, { ...unpaid, total: 400000 }), []);
});

test("lost acknowledgement retries the identical receipt ID, version, proof and reference", async () => {
  const pending = { current: null };
  const original = prepareReconciliation(order, unpaid, fields, id);
  await assert.rejects(sendCheckout(pending, "admin", original, async () => { throw new TypeError("Timeout after save"); }));
  const edited = { ...original, p_id: "218ad9ec-bcfb-4ac1-81b7-7e3e1e322dbe", p_reference: "DIFFERENT", p_evidence: "Edited proof", p_version: 6 };
  await sendCheckout(pending, "admin", edited, async args => {
    assert.deepEqual(args, original);
    return { order: { ...order, payment_status: "PAID" }, balance: paid };
  });
  assert.equal(pending.current, null);
});

test("SQL rollback releases an attempt for correction, but identity conflicts retain the old intent", async () => {
  const pending = { current: null }, args = prepareReconciliation(order, unpaid, fields, id);
  for (const cause of [{ code: "P0001", message: "VERSION_CONFLICT" }, { code: "P0001", message: "PAYMENT_EVIDENCE_REQUIRED" }, { code: "42501" }]) {
    await assert.rejects(sendCheckout(pending, "admin", args, async () => { throw new Error("Rejected", { cause }); }));
    assert.equal(pending.current, null);
  }
  await assert.rejects(sendCheckout(pending, "admin", args, async () => { throw new Error("Conflict", { cause: { code: "P0001", message: "IDEMPOTENCY_CONFLICT" } }); }));
  assert.equal(pending.current.request, args);
});

test("switching accounts cannot retry a former admin's financial evidence", async () => {
  const args = prepareReconciliation(order, unpaid, fields, id);
  const pending = { current: { ownerId: "previous-admin", request: args } };
  const own = { ...args, p_evidence: "Different admin checked own record" };
  await sendCheckout(pending, "current-admin", own, async request => {
    assert.equal(request, own);
    return { order: { ...order, payment_status: "PAID" } };
  });
});
