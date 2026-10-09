## 0.2.0 — 2026-10-09

- Thêm backend Supabase độc lập: RLS, Auth, đặt đơn idempotent, giá/phí máy chủ và tiến trình đơn.
- Thêm quản trị cửa hàng/catalog/giao hoa/COD/VietQR; xác nhận tiền thủ công có nhật ký.
- Thêm lịch sử riêng, mỗi đơn hoàn tất và đã trả một kỉ niệm, chia sẻ chính lời nhắn qua link/vườn và rút chia sẻ.
- Bỏ luồng lưu đơn Vercel Blob; chưa nối Supabase thì storefront tiếp tục ở chế độ trải nghiệm.
- Thêm SQL cài project mới, hướng dẫn Supabase, 19 tests và kiểm tra SDK local; benchmark một triệu kỉ niệm giả.
- Chưa nối Supabase thật hoặc kiểm thử UI mới trong trình duyệt; cần quyền dashboard, SMTP/Cron và xác minh QR ngân hàng trước khi mở nhận đơn.
