# Changelog

## 0.2.1 — 2026-10-09

- Nối Supabase production và kiểm tra catalog, vườn, quyền truy cập anon trên backend thật.
- Giữ cửa hàng đóng nhận đơn; cấu hình ngân hàng và dịch vụ ship vẫn do admin xác nhận.
- Đưa callback khôi phục mật khẩu về trang tài khoản sau khi Supabase xóa fragment chứa token.

## 0.2.0 — 2026-10-09

- Thêm backend Supabase độc lập: RLS, Auth, đặt đơn idempotent, giá/phí máy chủ và tiến trình đơn.
- Thêm quản trị cửa hàng/catalog/giao hoa/COD/VietQR; xác nhận tiền thủ công có nhật ký.
- Thêm lịch sử riêng, mỗi đơn hoàn tất và đã trả một kỉ niệm, chia sẻ chính lời nhắn qua link/vườn và rút chia sẻ.
- Bỏ luồng lưu đơn Vercel Blob; chưa nối Supabase thì storefront tiếp tục ở chế độ trải nghiệm.
- Thêm SQL cài project mới, hướng dẫn Supabase, 19 tests và kiểm tra SDK local; benchmark một triệu kỉ niệm giả.
- Chưa nối Supabase thật hoặc kiểm thử UI mới trong trình duyệt; cần quyền dashboard, SMTP/Cron và xác minh QR ngân hàng trước khi mở nhận đơn.

## 0.1.0 — 2026-10-09

- Thêm storefront Garden Dreams, hiệu ứng hoa/video, bộ sưu tập và giá VNĐ.
- Thêm tìm kiếm/lọc, yêu thích, giỏ hàng, form xem trước và bàn giao nội dung qua Zalo.
- Thêm API lưu đơn riêng tư có validation và chế độ nhận đơn được tắt mặc định.
- Thêm kiểm thử dữ liệu, responsive và hướng dẫn kích hoạt nhận đơn thật.
