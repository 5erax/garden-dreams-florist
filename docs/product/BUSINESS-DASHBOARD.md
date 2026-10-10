# Báo cáo kinh doanh và chọn hoa — 10/10/2026

Admin mở `/#admin` → **Tổng quan & thống kê**, chọn kỳ tối đa 92 ngày. Chỉ admin đã được cấp quyền có thể gọi `gd_business_dashboard`; anonymous và khách đăng nhập thông thường không được đọc báo cáo. CSV chỉ chứa ngày và số liệu tổng hợp.

| Chỉ số | Định nghĩa |
| --- | --- |
| Giá trị đơn chưa hủy | Tổng tiền đơn, gồm phí giao, theo ngày tạo; không chứng minh đã thu tiền |
| Thu / hoàn / thu trừ hoàn | Ledger MANUAL theo effective_at và ngày Việt Nam; số dư LEGACY hiển thị riêng |
| Còn phải thu hiện tại | Mọi đơn UNPAID chưa hủy, không giới hạn kỳ báo cáo |
| Giá trị đơn giao và đã thu | Đơn hiện DELIVERED/PAID, vẫn lọc theo ngày tạo; không phải kế toán ghi nhận theo ngày giao |
| Khách trong kỳ / mua lại | Phiên hoặc tài khoản có đơn chưa hủy; không đồng nhất với người duy nhất hoặc lượt truy cập |
| Hoa được đặt nhiều | Số bó và giá trị hoa trong snapshot đơn chưa hủy; chưa gồm phí giao |
| Lợi nhuận | Chưa cung cấp, vì chưa có đầy đủ giá vốn được ghi nhận và chi phí vận hành |

Production loại mọi is_test khỏi báo cáo. Staging bao gồm số liệu thử và có cảnh báo. Phản hồi lỗi giữ trạng thái lỗi, không thay bằng số 0; kết quả yêu cầu cũ không ghi đè kỳ mới. Báo cáo là snapshot; mở lại báo cáo sau khi cập nhật đơn.

SEO hiện đo chất lượng dữ liệu: số mẫu bán/tham khảo, thiếu slug, mô tả ngắn, ảnh giữ chỗ. **Chưa có kết nối Google Search Console hoặc đo lượt truy cập**, nên không có impression, click, vị trí từ khóa, visitor hoặc tỷ lệ chuyển đổi. Không gắn mã theo dõi, không truyền thông tin khách đến nhà cung cấp analytics trong đợt này.

Khách có thể lọc ngân sách, chỉ hiện mẫu bật bán, chọn tối đa ba bó để so sánh ảnh, dịp, thành phần, mô tả và giá; từ so sánh mở lựa chọn cỡ/giỏ hoặc trang riêng. Mẫu tham khảo vẫn ghi giá dự kiến và không được mua. Ảnh tham khảo giữ attribution qua ProductGallery. Ngân sách chưa gồm phí giao; trạng thái mẫu bật bán không đảm bảo tồn nguyên liệu.

Kiểm chứng: 161 tests toàn bộ; kiểm thử bổ sung sau sửa tương thích snapshot và kiểm tra UI mobile 390px. Database production thực thi RPC được, giữ nguyên hai đơn cũ; staging RPC tồn tại và anon không có EXECUTE. Không tạo đơn hay ghi nhận thanh toán thật. Security advisor không có ERROR; còn WARN SECURITY DEFINER và anonymous mode: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable. Hàm báo cáo kiểm tra is_admin trước khi đọc; không nới RLS.

Chưa kiểm chứng giao diện admin trên production, Google indexing hay hiệu năng triệu đơn. Các thống kê toàn thời gian hiện truy vấn trực tiếp; khi dữ liệu lớn cần benchmark và bảng tổng hợp. Tồn vẫn chưa bật; cần nhập nguyên liệu/công thức thật. Hosting thương mại, SMTP production, thông báo vận hành và hosted backup/restore vẫn thuộc các launch gate đã ghi trong LAUNCH-AUDIT-2026-10-10.md.
