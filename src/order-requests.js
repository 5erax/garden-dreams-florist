export const requestKinds = { CANCEL: "Đề nghị hủy đơn", CONTACT: "Sửa tên / điện thoại người nhận" };
export const requestStatuses = {
  OPEN: "Đang chờ cửa hàng", ACCEPTED: "Đã chấp thuận",
  REJECTED: "Chưa thể chấp thuận", WITHDRAWN: "Bạn đã rút yêu cầu",
};

export function canRequestChange(order) {
  return ["PENDING", "CONFIRMED"].includes(order.status) && !order.contacts_erased_at;
}

export function prepareOrderRequest(order, kind, fields, id) {
  if (!canRequestChange(order)) throw new Error("Đơn này không còn nhận yêu cầu thay đổi.");
  if (!Object.hasOwn(requestKinds, kind)) throw new Error("Chọn một loại yêu cầu hợp lệ.");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id || ""))
    throw new Error("Mã yêu cầu chưa hợp lệ. Tải lại lịch sử trước khi gửi.");
  const text = (name, min, max) => {
    const value = typeof fields[name] === "string" ? fields[name].trim() : "";
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b-\u001f]/.test(value))
      throw new Error("Kiểm tra độ dài tên, địa chỉ và lý do yêu cầu.");
    return value;
  };
  const body = { reason: text("reason", 5, 500) };
  if (kind === "CONTACT") {
    body.name = text("name", 2, 80);
    if (fields.address !== undefined && fields.address !== order.address)
      throw new Error("Đổi địa chỉ cần cửa hàng báo lại phí và lịch giao; biểu mẫu này chỉ sửa tên và điện thoại.");
    if (typeof order.address !== "string" || order.address.trim().length < 10 || order.address.length > 300 || /[\u0000-\u0008\u000b-\u001f]/.test(order.address))
      throw new Error("Địa chỉ đã lưu chưa hợp lệ hoặc không còn khả dụng. Tải lại đơn trước khi gửi.");
    body.address = order.address;
    body.phone = typeof fields.phone === "string" ? fields.phone.replace(/[\s().-]/g, "") : "";
    if (!/^(?:0|\+84)[35789]\d{8}$/.test(body.phone))
      throw new Error("Số điện thoại Việt Nam chưa hợp lệ.");
  }
  return { p_id: id, p_order: order.id, p_version: order.version, p_kind: kind, p_body: body };
}
