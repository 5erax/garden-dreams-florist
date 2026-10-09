import { products } from "./catalog.js";

export const vietnamDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export function normalizeCart(value, catalog = products) {
  if (!Array.isArray(value)) return [];
  const quantities = new Map();
  for (const line of value) {
    if (
      !catalog.some((p) => p.id === line?.id) ||
      !Number.isInteger(line?.quantity) ||
      line.quantity < 1
    )
      continue;
    quantities.set(
      line.id,
      Math.min(20, (quantities.get(line.id) || 0) + line.quantity),
    );
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

export const subtotal = (cart, catalog = products) =>
  normalizeCart(cart, catalog).reduce(
    (sum, line) =>
      sum + catalog.find((p) => p.id === line.id).price * line.quantity,
    0,
  );

export function validateOrder(input, now = new Date(), catalog = products) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Thông tin đặt hoa không hợp lệ.");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      input.requestId || "",
    )
  )
    throw new Error("Mã yêu cầu không hợp lệ. Vui lòng tải lại trang.");
  const text = (key, min, max) => {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if (
      value.length < min ||
      value.length > max ||
      /[\u0000-\u0008\u000b-\u001f]/.test(value)
    )
      throw new Error("Vui lòng kiểm tra tên, địa chỉ và lời nhắn.");
    return value;
  };
  const name = text("name", 2, 80);
  const address = text("address", 10, 300);
  const message = text("message", 0, 500);
  const phone =
    typeof input.phone === "string" ? input.phone.replace(/[\s().-]/g, "") : "";
  if (!/^(?:0|\+84)[35789]\d{8}$/.test(phone))
    throw new Error("Số điện thoại Việt Nam chưa hợp lệ.");
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 20
  )
    throw new Error("Giỏ hoa đang trống hoặc có quá nhiều sản phẩm.");
  const seen = new Set();
  const items = input.items.map((line) => {
    const product = catalog.find((p) => p.id === line?.id);
    if (
      !product ||
      seen.has(line.id) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 20
    )
      throw new Error("Số lượng hoa không hợp lệ.");
    seen.add(line.id);
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: line.quantity,
    };
  });
  const date = input.deliveryDate;
  const parsedDate =
    typeof date === "string"
      ? new Date(`${date}T12:00:00+07:00`)
      : new Date(NaN);
  const lastDate = vietnamDate(new Date(now.getTime() + 90 * 86400000));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !Number.isFinite(parsedDate.getTime()) ||
    vietnamDate(parsedDate) !== date ||
    date < vietnamDate(now) ||
    date > lastDate
  )
    throw new Error("Chọn ngày nhận hoa trong 90 ngày tới.");
  if (
    !["Sáng · 9–12h", "Chiều · 13–17h", "Tối · 18–20h"].includes(
      input.deliveryTime,
    )
  )
    throw new Error("Vui lòng chọn khung giờ nhận hoa.");
  if (input.consent !== true)
    throw new Error("Vui lòng đồng ý cho cửa hàng liên hệ về đơn hoa.");
  return {
    requestId: input.requestId,
    name,
    phone,
    address,
    message,
    deliveryDate: date,
    deliveryTime: input.deliveryTime,
    items,
    subtotal: subtotal(items, catalog),
    payment: "COD",
    status: "pending_confirmation",
  };
}
