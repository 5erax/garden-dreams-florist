# Tiến độ big update

Ngày 09/10/2026, giờ Việt Nam. Chủ shop đã yêu cầu triển khai lần lượt 32 task; thứ tự vận hành → vườn kỉ niệm → toàn trải nghiệm. Cập nhật sau mỗi task/lát cắt được kiểm chứng. Chỉ tick task lớn khi đạt cả tiêu chí nghiệm thu và kiểm chứng môi trường thật.

## Hiện tại

- **BU-01: hoàn thành — 1/32 task.** Database staging/API thật, cấu hình preview, cờ thử và deployment đã kiểm chứng theo tiêu chí SQL/SDK/Build/Ops.
- **BU-02: đang làm, chờ chủ shop cấu hình Gmail SMTP cho staging.** Đã chọn Gmail, chuẩn bị template/hướng dẫn và sửa callback; chưa nghiệm thu email thật.
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

### BU-01c — Preview READY và kết thúc task

- Đã push branch `feature/bu-01-isolated-staging`. Vercel xác nhận deployment `dpl_25B6y2Gvrf7k4oq4B8M7faWW2xZp` READY, project đúng, commit `9a2014aaf11b3dcd50b02c41c0e49608384b7e95`, target preview.
- [Preview](https://garden-dreams-florist-8k1qq8aha-dhas-projects-901181f4.vercel.app). URL/key production vẫn ở target production; preview dùng riêng staging. Frontend build/runtime kiểm tra đúng ref và loại key.
- Đánh dấu BU-01 hoàn tất theo kiểm chứng của task; **không** đánh dấu Auth/email, luồng người dùng thật hoặc UI hoàn tất. Mở preview để kiểm tra UI bị trình duyệt từ chối quyền (`user declined permission`); không dùng công cụ khác để vượt hạn chế. BU-04 còn chờ quyền/kiểm tra trực tiếp.
- Production chưa áp dụng migration 005, chưa merge branch nên website hiện tại chưa nhận thay đổi backend. Không mở bán hoặc tạo đơn giả trên production.

### BU-02a — Chuẩn bị SMTP, callback và template

- Có [AUTH-EMAIL-SETUP.md](../AUTH-EMAIL-SETUP.md) với phương án ít phí, các trường SMTP, URL Configuration riêng staging/production, hai template xác nhận/khôi phục và checklist nghiệm thu.
- Đề xuất Gmail riêng cho shop để thử staging khi chưa có domain; production đánh giá domain do shop sở hữu với Resend/Brevo Free. Chưa đăng ký dịch vụ, mua domain hoặc đưa SMTP secret vào frontend.
- Chưa cấu hình dashboard hay gửi email thật; BU-02 **chưa hoàn thành**. Cần người gửi SMTP, callback và kiểm thử nhận/mở/khôi phục/đăng xuất trước khi tiếp tục nghiệm thu BU-03.

### BU-02b — Sửa callback xác nhận/khôi phục

- Chủ shop chọn Gmail riêng để thử staging và sẽ tự điền App Password trong Supabase. Không yêu cầu hoặc lưu SMTP secret trong chat/repo/frontend.
- Nhận diện callback trước khi SDK xóa fragment; sau khi khởi tạo Auth, đưa khách về Góc của tôi, bỏ token/tham số lỗi khỏi URL và giữ query không liên quan. Link lỗi/hết hạn có thông báo chung, không hiển thị lỗi/token do provider gửi. Đăng nhập hoặc khôi phục thành công xóa thông báo cũ.
- Kiểm chứng: 27 tests qua, gồm 2 tests nhận diện callback/làm sạch URL; build staging qua. Chưa kiểm chứng callback trực tiếp trong trình duyệt hoặc gửi/nhận email thật.
- Tiến độ vẫn **1/32 task**. BU-02 chưa tick; BU-03 chờ Auth/SMTP thật và dữ liệu kiểm thử của chủ shop.
