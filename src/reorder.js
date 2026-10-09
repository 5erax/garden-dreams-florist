import { cartChoice, cartKey, normalizeCart } from "./order.js";

export const reorderReasons = {
  INVALID_ITEMS: "Đơn cũ không có danh sách hoa hợp lệ để chọn lại.",
  INVALID_ITEM: "Mã hoa hoặc cỡ trong đơn cũ không hợp lệ.",
  INVALID_QUANTITY: "Số lượng trong đơn cũ không hợp lệ.",
  PRODUCT_UNAVAILABLE: "Mẫu hoa này đã ngừng nhận đặt hoặc không còn trong bộ sưu tập.",
  VARIANT_UNAVAILABLE: "Cỡ bó cũ đã ngừng nhận đặt hoặc không thuộc mẫu hoa này. Không tự đổi sang cỡ khác.",
  PRICE_UNAVAILABLE: "Chưa xác nhận được giá hiện tại của mẫu hoa này.",
  QUANTITY_LIMIT: "Giỏ hoa giữ tối đa 20 bó cho mỗi mẫu / cỡ; chỉ thêm phần còn chỗ.",
  CART_LINE_LIMIT: "Giỏ hoa giữ tối đa 20 mẫu / cỡ khác nhau. Chỉnh giỏ trước khi thêm mẫu mới.",
};

export function prepareReorder(items, cart, products) {
  const catalog = Array.isArray(products) ? products : [];
  const existing = normalizeCart(cart, catalog);
  const merged = existing.map(line => ({ ...line }));
  const unavailable = [];
  const requests = [];
  const requestedQuantities = new Map();
  if (!Array.isArray(items)) return {
    cart: merged, lines: [], unavailable: [{ name: "Đơn hoa cũ", reason: "INVALID_ITEMS" }], addedQuantity: 0, total: 0,
  };
  for (const snapshot of items) {
    const name = typeof snapshot?.name === "string" && snapshot.name.trim() ? snapshot.name.trim() : "Mẫu hoa trong đơn cũ";
    const sizeName = typeof snapshot?.sizeName === "string" ? snapshot.sizeName : "";
    if (!Number.isSafeInteger(snapshot?.id) || snapshot.id < 1 || (snapshot.variantId != null && (!Number.isSafeInteger(snapshot.variantId) || snapshot.variantId < 1))) {
      unavailable.push({ name, sizeName, reason: "INVALID_ITEM" });
      continue;
    }
    if (!Number.isSafeInteger(snapshot.quantity) || snapshot.quantity < 1 || snapshot.quantity > 20) {
      unavailable.push({ name, sizeName, reason: "INVALID_QUANTITY" });
      continue;
    }
    const request = { id: snapshot.id, ...(snapshot.variantId == null ? {} : { variantId: snapshot.variantId }), quantity: snapshot.quantity };
    const choice = cartChoice(request, catalog);
    if (!choice) {
      const product = catalog.find(item => item.id === request.id);
      unavailable.push({ name, sizeName, reason: !product || product.active === false ? "PRODUCT_UNAVAILABLE" : "VARIANT_UNAVAILABLE" });
      continue;
    }
    if (!Number.isSafeInteger(choice.price) || choice.price < 0 || !Number.isSafeInteger(choice.price * 20)) {
      unavailable.push({ name, sizeName, reason: "PRICE_UNAVAILABLE" });
      continue;
    }
    requests.push(request);
    const key = cartKey(request);
    requestedQuantities.set(key, (requestedQuantities.get(key) ?? 0) + request.quantity);
  }

  const indexes = new Map(merged.map((line, index) => [cartKey(line), index]));
  const lines = [];
  let addedQuantity = 0;
  let total = 0;
  for (const request of normalizeCart(requests, catalog)) {
    const key = cartKey(request);
    const choice = cartChoice(request, catalog);
    const index = indexes.get(key);
    const existingQuantity = index == null ? 0 : merged[index].quantity;
    const requested = requestedQuantities.get(key);
    const lineBlocked = existing.length > 20 || (index == null && merged.length >= 20);
    const added = lineBlocked ? 0 : Math.min(request.quantity, 20 - existingQuantity);
    const reason = lineBlocked ? "CART_LINE_LIMIT" : added < requested ? "QUANTITY_LIMIT" : null;
    lines.push({
      id: request.id,
      ...(request.variantId == null ? {} : { variantId: request.variantId }),
      name: choice.name, image: choice.image, price: choice.price,
      sizeName: choice.sizeName || "", sku: choice.sku || "",
      quantity: requested, existingQuantity, addedQuantity: added, reason,
      subtotal: choice.price * added,
    });
    if (!added) continue;
    if (index == null) {
      indexes.set(key, merged.length);
      merged.push({ ...request, quantity: added });
    } else merged[index] = { ...merged[index], quantity: existingQuantity + added };
    addedQuantity += added;
    total += choice.price * added;
  }
  return { cart: merged, lines, unavailable, addedQuantity, total };
}
