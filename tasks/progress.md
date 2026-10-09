# Tiến độ big update

Ngày 09/10/2026, giờ Việt Nam. Chủ shop đã yêu cầu triển khai lần lượt 32 task; thứ tự vận hành → vườn kỉ niệm → toàn trải nghiệm. Cập nhật sau mỗi task/lát cắt được kiểm chứng. Chỉ tick task lớn khi đạt cả tiêu chí nghiệm thu và kiểm chứng môi trường thật.

## Hiện tại

- **BU-01: đang thực hiện.** Chủ shop đã cung cấp URL/publishable key cho project staging riêng `tgvozhrkolcpszyyrgth`.
- **BU-02: chờ cấu hình dịch vụ email.** Chưa có domain/SMTP; chủ shop yêu cầu chuẩn bị cấu hình và đề xuất phương án ít phí.
- **BU-03 tới BU-32: chưa bắt đầu.** Phụ thuộc các cổng nghiệm thu trong todo.md.
- Production tiếp tục đóng nhận đơn. Chưa merge/deploy thay đổi backend vào production.

## Nhật ký

### BU-01a — Chặn cấu hình backend nhầm môi trường

- Hoàn thành validator Vite: preview không dùng project production, staging chỉ dùng project staging đã chốt; local chỉ dùng loopback; chỉ chấp nhận publishable/anon key.
- Có cấu hình demo/local/staging/production và hướng dẫn theo mode. Fixture SDK cố định loopback; benchmark cố định PGlite in-memory.
- Kiểm chứng: 3 tests cấu hình qua, build hiện tại qua. Đã thử trường hợp URL/key thiếu, URL có credential/path/query, secret/service-role key và override preview thành production.
- Chưa hoàn tất BU-01: còn cờ đơn thử phía database, cấu hình preview và cài/nghiệm thu schema staging thật.

### BU-01b — Cờ thử tại database và xác nhận runtime

- Migration 005 thêm runtime do chủ database quản lý, cờ `is_test` bất biến trên đơn/kỉ niệm, public RPC xác nhận môi trường và projection tài chính loại đơn thử. Vườn sandbox cho xem thiệp thử để QA.
- Frontend kiểm tra cả môi trường/project trước thao tác dữ liệu và hiển thị nhãn thử. Fixture SDK/benchmark dùng runtime local, không tăng bộ đếm kỉ niệm thật.
- File cài staging sinh từ migrations đã chạy thử bằng PostgreSQL nhúng; từ chối database đã có schema/tài khoản, không reset dữ liệu hoặc tạo khách/đơn giả.
- Chủ shop đã chạy SQL staging. SDK qua API thật xác nhận đúng project/runtime, 20 sản phẩm, đóng nhận đơn, vườn/count rỗng, cột thử và anon bị từ chối vào 5 bảng riêng/RPC tạo đơn. Không tạo đơn hoặc gửi email trên hosting thật trong bước này.
- Kiểm chứng: toàn bộ 25 tests qua; SDK local qua luồng đặt/đối soát/chia sẻ/revoke/quyền; build staging qua; npm audit 0 vulnerabilities. Review bổ sung chặn dev dùng production và không đưa URL không hợp lệ vào thông báo lỗi.
- Vercel preview đã có URL/key staging và `VITE_APP_ENV=staging`; production giữ URL/key cũ, thêm marker production. Connector thiếu quyền scope; CLI hiện có quyền đúng project và đã thực hiện cấu hình.
- Chưa chạy lại benchmark một triệu dấu sau migration 005; chưa kiểm thử giao diện/SMTP/QR thật. Còn xác nhận preview deployment READY trước khi tick toàn bộ BU-01.
