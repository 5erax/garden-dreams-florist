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
