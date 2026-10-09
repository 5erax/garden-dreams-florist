import { createClient } from "@supabase/supabase-js";
import { checkEnvironment, checkBackendEnvironment } from "./environment.js";
import { isAuthCallback } from "./auth-callback.js";
import { guestStorage } from "./guest-session.js";

const config = checkEnvironment(import.meta.env);
const { url, key } = config;
export const appEnvironment = config.environment;
export const backendReady = Boolean(url && key);
// Capture the callback marker before the SDK consumes and clears its fragment.
export const authCallbackPending =
  typeof window !== "undefined" && isAuthCallback(window.location);
let deviceStorage;
try { deviceStorage = globalThis.localStorage; } catch {}
const storageKey = backendReady ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "gd-demo-session";
export const guestSessionStorage = guestStorage(storageKey, deviceStorage);
export const backend = backendReady
  ? createClient(url, key, {
      // Only explicitly remembered guest sessions persist; regular accounts stay in memory.
      auth: {
        persistSession: true,
        storageKey,
        storage: guestSessionStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let environmentCheck;
export async function verifyEnvironment() {
  if (!backend) throw new Error("Backend chưa được kết nối.");
  if (!environmentCheck)
    environmentCheck = (async () => {
      const { data, error } = await backend.rpc("gd_environment");
      if (error)
        throw new Error(
          "Chưa xác nhận được môi trường backend. Kiểm tra migration và kết nối.",
        );
      try {
        checkBackendEnvironment(config, data);
      } catch {
        throw new Error(
          "Cấu hình website và môi trường backend không khớp. Chưa thể thao tác.",
        );
      }
      return data;
    })().finally(() => {
      environmentCheck = null;
    });
  return environmentCheck;
}

export async function guestCheckoutEnabled() {
  if (!backendReady) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
    return response.ok && (await response.json()).external?.anonymous_users === true;
  } catch { return false; }
}

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
  VARIANT_UNAVAILABLE: "Cỡ bó đã ngừng nhận đặt hoặc không thuộc sản phẩm này. Chọn lại cỡ trước khi gửi.",
  SHIPPING_UNAVAILABLE: "Dịch vụ giao này chưa khả dụng.",
  DELIVERY_UNAVAILABLE: "Ca giao vừa thay đổi, đã đầy hoặc qua giờ nhận đặt. Kiểm tra lịch và chọn ca khác; thông tin đang nhập vẫn được giữ.",
  INVALID_DELIVERY_RULE: "Kiểm tra khu vực, ngày trong tuần, sức chứa và thời gian đặt trước.",
  DELIVERY_RULE_REQUIRED: "Tạo ít nhất một ca đang nhận, có sức chứa và thuộc dịch vụ đang hoạt động trước khi bật lịch.",
  DELIVERY_RULE_IDENTITY_IMMUTABLE: "Giữ nguyên khu vực và ca/ngày của cấu hình này. Tạo cấu hình khác nếu cần chuyển.",
  CAPACITY_BELOW_RESERVATIONS: "Không thể giảm sức chứa dưới số đơn đã giữ chỗ. Xử lý các đơn trước khi đổi năng lực.",
  DAY_HAS_RESERVATIONS: "Ngày này có đơn đã giữ chỗ. Xử lý lịch giao của các đơn trước khi đóng ngày.",
  CALENDAR_SNAPSHOT_IMMUTABLE: "Lịch đã lưu trên đơn không thể sửa trực tiếp.",
  INVALID_QUEUE_FILTER: "Kiểm tra bộ lọc và mã đơn bắt đầu bằng GD-. Tải lại danh sách nếu mốc phân trang không còn hợp lệ.",
  INVALID_NOTE: "Ghi chú cần từ 1 đến 1.000 ký tự.",
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
  await verifyEnvironment();
  const { data, error } = await backend.rpc(name, args);
  if (error) throw new Error(backendError(error), { cause: error });
  return data;
}
export async function result(query) {
  await verifyEnvironment();
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
  "id,reference,recipient_name,recipient_phone,address,card_message,delivery_date,delivery_time,items,subtotal,shipping,total,payment_method,bank,status,payment_status,version,created_at,updated_at,contacts_erased_at,is_test";
