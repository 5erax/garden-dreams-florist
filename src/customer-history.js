export const historyPageSize = 20;
export const historyLimit = 200;
export const historyViews = [
  { id: "ALL", name: "Tất cả" },
  { id: "ACTIVE", name: "Đang thực hiện" },
  { id: "PAST", name: "Đã kết thúc" },
];

const pastStatuses = new Set(["DELIVERED", "CANCELLED"]);
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function isPastOrder(order) {
  return pastStatuses.has(order.status);
}

export function hasMemoryEligibility(order) {
  return order.status === "DELIVERED" && order.payment_status === "PAID" && !order.is_test;
}

export function needsBankPayment(order) {
  return order.payment_method === "VIETQR" && order.payment_status === "UNPAID" && order.status !== "CANCELLED";
}

export function historySummary(orders) {
  return orders.reduce((summary, order) => {
    summary.loaded += 1;
    if (isPastOrder(order)) summary.past += 1;
    else summary.active += 1;
    if (needsBankPayment(order)) summary.transfer += 1;
    if (hasMemoryEligibility(order)) summary.memories += 1;
    return summary;
  }, { loaded: 0, active: 0, past: 0, transfer: 0, memories: 0 });
}

export function searchableText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi-VN").trim();
}

export function filterHistory(orders, { view = "ALL", search = "", payment = "ALL" } = {}) {
  const words = searchableText(search).split(/\s+/).filter(Boolean);
  return orders.filter(order => {
    if (view === "ACTIVE" && isPastOrder(order)) return false;
    if (view === "PAST" && !isPastOrder(order)) return false;
    if (payment !== "ALL" && order.payment_status !== payment) return false;
    if (!words.length) return true;
    const text = searchableText([
      order.reference, order.recipient_name,
      ...(order.items ?? []).flatMap(item => [item.name, item.sizeName, item.sku]),
    ].join(" "));
    return words.every(word => text.includes(word));
  });
}

export function mergeHistoryPage(previous, incoming, limit = historyLimit) {
  const seen = new Set(previous.map(order => order.id));
  return [...previous, ...incoming.filter(order => {
    if (seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  })].slice(0, limit);
}

export function historyDate(value, dayOnly = false) {
  if (!value) return "Chưa có ngày";
  const date = new Date(dayOnly ? `${value}T12:00:00+07:00` : value);
  if (!Number.isFinite(date.getTime())) return "Chưa có ngày";
  return dateFormatter.format(date);
}

export function historyItemTitle(order) {
  return (order.items ?? []).map(item => `${item.name}${item.sizeName ? ` · ${item.sizeName}` : ""}`).join(", ") || "Đơn hoa của bạn";
}

export function historyNextStep(order) {
  if (order.status === "CANCELLED") return "Đơn đã hủy. Xem chi tiết để đọc lịch sử xử lý.";
  if (needsBankPayment(order)) return "Mở đơn để lấy VietQR. Shop xác nhận tiền sau khi kiểm tra.";
  if (hasMemoryEligibility(order)) return order.card_message ? "Xem lời nhắn và chọn cách chia sẻ kỉ niệm." : "Xem lại hành trình của bó hoa.";
  if (order.status === "DELIVERED" && order.payment_status === "UNPAID") return "Hoa đã giao; trạng thái nhận tiền đang chờ shop cập nhật.";
  if (order.payment_status === "REFUNDED") return "Khoản hoàn tiền đã được shop ghi nhận. Xem chi tiết đơn.";
  const hints = {
    PENDING: "Shop sẽ kiểm tra và xác nhận đơn hoa của bạn.",
    CONFIRMED: "Đơn đã được xác nhận. Bó hoa đang chờ chuẩn bị.",
    PREPARING: "Shop đang chăm chút bó hoa. Xem tiến trình tại đây.",
    SHIPPING: "Bó hoa đang trên đường đến người nhận.",
    DELIVERED: "Hoa đã đến nơi. Xem lại hành trình của bó hoa.",
  };
  return hints[order.status] || "Mở chi tiết để xem tiến trình mới nhất từ shop.";
}
