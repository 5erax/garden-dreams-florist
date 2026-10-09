import test from "node:test";
import assert from "node:assert/strict";
import {
  historyPageSize, historyLimit, isPastOrder, hasMemoryEligibility,
  needsBankPayment, historySummary, searchableText, filterHistory,
  mergeHistoryPage, historyDate, historyItemTitle, historyNextStep,
} from "../src/customer-history.js";

const order = (id, fields = {}) => ({
  id,
  reference: `GD-${id}`,
  status: "PENDING",
  payment_status: "UNPAID",
  payment_method: "COD",
  recipient_name: "Đặng Ánh",
  recipient_phone: "0832345780",
  address: "Địa chỉ riêng không tìm theo",
  card_message: "lời nhắn tuyệt đối riêng",
  delivery_date: "2026-10-10",
  items: [{ name: "Khúc hồng", sizeName: "Vừa", sku: "ROSE-M" }],
  ...fields,
});

test("history separates fulfillment from payment and never offers bank payment on canceled orders", () => {
  const deliveredUnpaid = order("1", { status: "DELIVERED", payment_method: "VIETQR" });
  assert.equal(isPastOrder(deliveredUnpaid), true);
  assert.equal(needsBankPayment(deliveredUnpaid), true);
  assert.equal(hasMemoryEligibility(deliveredUnpaid), false);
  assert.equal(isPastOrder(order("2", { status: "SHIPPING" })), false);
  assert.equal(isPastOrder(order("3", { status: "CANCELLED" })), true);
  assert.equal(needsBankPayment(order("4", { status: "CANCELLED", payment_method: "VIETQR" })), false);
  assert.equal(needsBankPayment(order("5", { payment_method: "VIETQR", payment_status: "PAID" })), false);
});

test("summary counts only supplied loaded orders and excludes test/refunded orders from memory eligibility", () => {
  const loaded = [
    order("1"),
    order("2", { status: "SHIPPING", payment_method: "VIETQR" }),
    order("3", { status: "DELIVERED", payment_status: "PAID" }),
    order("4", { status: "DELIVERED", payment_status: "REFUNDED" }),
    order("5", { status: "DELIVERED", payment_status: "PAID", is_test: true }),
    order("6", { status: "CANCELLED", payment_method: "VIETQR" }),
  ];
  assert.deepEqual(historySummary(loaded), { loaded: 6, active: 2, past: 4, transfer: 1, memories: 1 });
  assert.deepEqual(historySummary([]), { loaded: 0, active: 0, past: 0, transfer: 0, memories: 0 });
});

test("local search is Vietnamese accent insensitive, combines words, and does not index private card or contacts", () => {
  const loaded = [order("ABC"), order("XYZ", { recipient_name: "Mai", items: [{ name: "Nắng dịu" }] })];
  assert.equal(searchableText(" ĐẶNG ÁNH "), "dang anh");
  assert.deepEqual(filterHistory(loaded, { search: "dang HONG" }).map(row => row.id), ["ABC"]);
  assert.deepEqual(filterHistory(loaded, { search: "GD-xyz" }).map(row => row.id), ["XYZ"]);
  assert.deepEqual(filterHistory(loaded, { search: "rose-m vua" }).map(row => row.id), ["ABC"]);
  assert.equal(filterHistory(loaded, { search: "khuc mai" }).length, 0);
  for (const search of ["0832345780", "tuyet doi", "dia chi rieng"]) assert.equal(filterHistory(loaded, { search }).length, 0);
});

test("view and payment filters combine without altering loaded source orders", () => {
  const loaded = [order("1"), order("2", { status: "DELIVERED", payment_status: "PAID" }), order("3", { status: "CANCELLED" })];
  const before = structuredClone(loaded);
  assert.deepEqual(filterHistory(loaded, { view: "ACTIVE" }).map(row => row.id), ["1"]);
  assert.deepEqual(filterHistory(loaded, { view: "PAST", payment: "UNPAID" }).map(row => row.id), ["3"]);
  assert.deepEqual(filterHistory(loaded, { view: "PAST", payment: "PAID", search: "hong" }).map(row => row.id), ["2"]);
  assert.equal(filterHistory(loaded, { search: "  \n " }).length, 3);
  assert.deepEqual(loaded, before);
});

test("cursor page merging preserves server order, deduplicates boundary rows, and bounds local history", () => {
  const previous = [order("3"), order("2")];
  const incoming = [order("2"), order("1"), order("1"), order("0")];
  assert.deepEqual(mergeHistoryPage(previous, incoming).map(row => row.id), ["3", "2", "1", "0"]);
  assert.deepEqual(previous.map(row => row.id), ["3", "2"]);
  assert.deepEqual(mergeHistoryPage(previous, incoming, 3).map(row => row.id), ["3", "2", "1"]);
  assert.equal(historyPageSize, 20);
  assert.equal(mergeHistoryPage([], Array.from({ length: 300 }, (_, id) => order(String(id)))).length, historyLimit);
});

test("history dates consistently show Vietnam calendar dates at UTC boundaries", () => {
  assert.equal(historyDate("2026-10-09T18:30:00Z"), historyDate("2026-10-10", true));
  assert.notEqual(historyDate("2026-10-09T16:30:00Z"), historyDate("2026-10-10", true));
  assert.equal(historyDate("not-a-date"), "Chưa có ngày");
  assert.equal(historyDate(null), "Chưa có ngày");
});

test("old snapshot items render without sizes or contact values", () => {
  assert.equal(historyItemTitle(order("1", { items: [{ name: "Nắng dịu" }] })), "Nắng dịu");
  assert.equal(historyItemTitle(order("2")), "Khúc hồng · Vừa");
  assert.equal(historyItemTitle({ items: [] }), "Đơn hoa của bạn");
  assert.equal(filterHistory([order("3", { recipient_name: null, items: [] })], { search: "GD-3" }).length, 1);
});

test("next-step copy respects manual payment confirmation, test orders, refunds and private sharing", () => {
  assert.match(historyNextStep(order("1", { payment_method: "VIETQR" })), /Shop xác nhận tiền sau khi kiểm tra/);
  assert.match(historyNextStep(order("2", { status: "DELIVERED", payment_status: "PAID" })), /chọn cách chia sẻ/);
  assert.doesNotMatch(historyNextStep(order("3", { status: "DELIVERED", payment_status: "PAID", is_test: true })), /chia sẻ/);
  assert.doesNotMatch(historyNextStep(order("4", { status: "DELIVERED", payment_status: "PAID", card_message: "" })), /chia sẻ/);
  assert.match(historyNextStep(order("5", { status: "DELIVERED", payment_status: "REFUNDED" })), /hoàn tiền/);
  assert.match(historyNextStep(order("6", { status: "SHIPPING" })), /trên đường/);
  assert.match(historyNextStep(order("7", { status: "CANCELLED", payment_method: "VIETQR" })), /Đơn đã hủy/);
});
