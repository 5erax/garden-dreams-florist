export const reconciliationActions = { RECEIPT: "Ghi nhận tiền thu", REFUND: "Ghi nhận tiền hoàn" };

export function validateReconciliationReport(value, period) {
  const unsigned = ["received", "refunded", "eventCount", "legacyReceiptBalance", "legacyRefundBalance"];
  if (!value || value.basis !== "SETTLEMENT_DATE" || value.from !== period.from || value.to !== period.to ||
      unsigned.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0) ||
      !Number.isSafeInteger(value.netCollected) || value.netCollected !== value.received - value.refunded)
    throw new Error("Số liệu hoặc kỳ đối soát chưa hợp lệ để hiển thị chính xác. Tải lại báo cáo trước khi sử dụng.");
  return value;
}

export function validatePaymentBalance(value, orderId) {
  const amounts = ["total", "received", "refunded", "heldCash", "receivable", "refundable"];
  if (!value || value.orderId !== orderId || typeof value.legacyBalance !== "boolean" || typeof value.fullOnly !== "boolean" ||
      amounts.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0) ||
      value.received > value.total || value.refunded > value.received || value.heldCash !== value.received - value.refunded ||
      value.refundable > value.heldCash || value.receivable > value.total)
    throw new Error("Số dư trả về chưa hợp lệ. Tải lại sổ đối soát trước khi thao tác.");
  return value;
}

export function allowedReconciliationActions(order, balance) {
  if (!balance || balance.orderId !== order.id || balance.total !== Number(order.total) || balance.total <= 0) return [];
  if (["UNPAID","PARTIAL"].includes(order.payment_status) && ["CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"].includes(order.status) &&
      balance.refunded === 0 && balance.receivable > 0) return balance.refundable>0?["RECEIPT","REFUND"]:["RECEIPT"];
  if (balance.refundable > 0) return ["REFUND"];
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
  if(order.payment_method==='VIETQR'&&!reference)throw Error('Nhập mã giao dịch ngân hàng cho VietQR.');
  const limit=fields.action==='RECEIPT'?balance.receivable:balance.refundable;
  const amount=fields.amount==null?limit:Number(fields.amount);
  if(!Number.isSafeInteger(amount)||amount<1||amount>limit)throw Error('Số tiền phải nằm trong số dư còn được thu/hoàn.');
  return { ...(fields.amount==null?{}:{p_amount:amount}),p_id: id, p_order: order.id, p_version: order.version, p_action: fields.action, p_evidence: evidence, p_reference: reference };
}
