import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const backendReady = Boolean(url && key);
if (key?.startsWith("sb_secret_"))
  throw new Error("Chỉ dùng Supabase publishable key trong frontend.");
if (key?.startsWith("eyJ")) {
  try {
    if (JSON.parse(atob(key.split(".")[1])).role !== "anon")
      throw new Error("INVALID_PUBLIC_KEY");
  } catch {
    throw new Error("Supabase key chưa đúng loại public/anon.");
  }
}
export const backend = backendReady
  ? createClient(url, key, {
      // Keep bearer tokens in memory; refreshing the page requires signing in again.
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const messages = {
  AUTH_REQUIRED: "Vui lòng đăng nhập trước.",
  ADMIN_REQUIRED: "Chức năng này dành cho admin.",
  SHOP_CLOSED: "Cửa hàng chưa mở nhận đơn.",
  CONSENT_REQUIRED: "Vui lòng đồng ý cho cửa hàng xử lý đơn.",
  INVALID_CONTACT: "Kiểm tra tên, số điện thoại và địa chỉ.",
  INVALID_DATE: "Ngày giao phải nằm trong 90 ngày tới.",
  INVALID_TIME: "Chọn khung giờ giao hợp lệ.",
  INVALID_ITEMS: "Sản phẩm hoặc số lượng chưa hợp lệ.",
  PRODUCT_UNAVAILABLE: "Một sản phẩm đã ngừng nhận đặt.",
  SHIPPING_UNAVAILABLE: "Dịch vụ giao này chưa khả dụng.",
  PAYMENT_UNAVAILABLE: "Phương thức thanh toán này chưa khả dụng.",
  PRICE_CHANGED:
    "Giá hoặc phí giao đã thay đổi. Cập nhật giá và kiểm tra tổng tiền trước khi gửi lại.",
  IDEMPOTENCY_CONFLICT:
    "Yêu cầu này đã được gửi trước đó. Kiểm tra lịch sử mua trước khi đặt thêm.",
  VERSION_CONFLICT:
    "Dữ liệu vừa được cập nhật ở nơi khác. Tải lại trước khi sửa.",
  INVALID_TRANSITION: "Không thể chuyển đơn sang trạng thái này.",
  INVALID_PAYMENT_TRANSITION:
    "Không thể chuyển thanh toán sang trạng thái này.",
  PAYMENT_EVIDENCE_REQUIRED:
    "Ghi nội dung đối soát hoặc mã giao dịch (ít nhất 5 ký tự).",
  MEMORY_UNAVAILABLE:
    "Kỉ niệm chỉ chia sẻ khi đơn hoàn tất, đã trả tiền và có lời nhắn.",
  NOT_FOUND: "Không tìm thấy dữ liệu hoặc bạn không có quyền xem.",
};
export function backendError(error) {
  if (error?.message?.includes("ORDER_RATE_LIMIT"))
    return "Bạn vừa gửi nhiều đơn liên tiếp. Chờ một chút rồi thử lại; đơn đã lưu vẫn có trong lịch sử.";
  for (const [code, text] of Object.entries(messages))
    if (error?.message?.includes(code)) return text;
  if (
    error?.code === "23514" ||
    error?.code === "22P02" ||
    error?.code === "22008"
  )
    return "Thông tin chưa hợp lệ. Kiểm tra lại các trường.";
  return "Chưa thực hiện được thao tác. Kiểm tra kết nối rồi thử lại.";
}
export async function call(name, args = {}) {
  if (!backend) throw new Error("Backend chưa được kết nối.");
  const { data, error } = await backend.rpc(name, args);
  if (error) throw new Error(backendError(error), { cause: error });
  return data;
}
export async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(backendError(error));
  return data;
}
export const orderStatuses = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang bó hoa",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};
export const paymentStatuses = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã nhận tiền",
  REFUNDED: "Đã ghi nhận hoàn tiền",
};
export const orderColumns =
  "id,reference,recipient_name,recipient_phone,address,card_message,delivery_date,delivery_time,items,subtotal,shipping,total,payment_method,bank,status,payment_status,version,created_at,updated_at,contacts_erased_at";
