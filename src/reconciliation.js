export const reconciliationActions = { RECEIPT: "Ghi nhận đã thu đủ", REFUND: "Ghi nhận đã hoàn đủ" };

export function validatePaymentBalance(value, orderId) {
  const amounts = ["total", "received", "refunded", "heldCash", "receivable", "refundable"];
  if (!value || value.orderId !== orderId || typeof value.legacyBalance !== "boolean" || typeof value.fullOnly !== "boolean" ||
      amounts.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0) ||
      value.refunded > value.received || value.heldCash !== value.received - value.refunded ||
      value.refundable > value.heldCash || value.receivable > value.total)
    throw new Error("Số dư trả về chưa hợp lệ. Tải lại sổ đối soát trước khi thao tác.");
  return value;
}

export function allowedReconciliationActions(order, balance) {
  if (!balance || !balance.fullOnly || balance.orderId !== order.id || balance.total !== Number(order.total) || balance.total <= 0) return [];
  if (order.payment_status === "UNPAID" && ["PENDING", "CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"].includes(order.status) &&
      balance.received === 0 && balance.refunded === 0 && balance.receivable === balance.total) return ["RECEIPT"];
  if (order.payment_status === "PAID" && balance.received === balance.total && balance.refunded === 0 && balance.refundable === balance.total) return ["REFUND"];
  return [];
}

export function prepareReconciliation(order, balance, fields, id) {
  validatePaymentBalance(balance, order.id);
  if (!allowedReconciliationActions(order, balance).includes(fields.action))
    throw new Error("Thao tác thu/hoàn này chưa khả dụng. Tải lại đơn và số dư trước khi ghi nhận.");
  if (fields.checked !== true) throw new Error("Xác nhận bạn đã kiểm tra tiền thu hoặc tiền hoàn thực tế trước khi ghi nhận.");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id || ""))
    throw new Error("Mã thao tác chưa hợp lệ. Tải lại trước khi ghi nhận.");
  const evidence = typeof fields.evidence === "string" ? fields.evidence.trim() : "";
  const reference = typeof fields.reference === "string" ? fields.reference.trim() : "";
  if (evidence.length < 5 || evidence.length > 500 || /[\u0000-\u0008\u000b-\u001f]/.test(evidence))
    throw new Error("Nội dung đối soát cần từ 5 đến 500 ký tự, không chứa ký tự điều khiển.");
  if (reference.length > 120 || !/^[A-Za-z0-9 /._-]*$/.test(reference))
    throw new Error("Tham chiếu tối đa 120 ký tự; dùng chữ không dấu, số, khoảng trắng hoặc / . _ -.");
  return { p_id: id, p_order: order.id, p_version: order.version, p_action: fields.action, p_evidence: evidence, p_reference: reference };
}
