# BU-05 — Sao lưu, phục hồi và retention

Ngày 09/10/2026, giờ Việt Nam. Chủ shop yêu cầu agent tự triển khai, không giao các bước cấu hình thường lệ cho chủ shop. Tài liệu này ghi quy trình vận hành và bằng chứng; không coi một hướng dẫn là bản backup đã có.

## Phần đã kiểm chứng

`node --test tests/backup-restore.test.js` tạo database PostgreSQL nhúng **local**, chạy các migrations đang có, tạo dữ liệu giả bằng RPC, xuất archive ra đĩa, đóng database nguồn rồi mở database mới từ chính archive đó. Không có kết nối mạng hoặc credential Supabase trong bài kiểm tra.

- Khôi phục 6 đơn, 3 kỉ niệm, 20 events, 2 audit records và 20 sản phẩm.
- Kiểm tra checksum SHA-256, giá/items/phí ship/version/trạng thái đã chốt, thiệp/vườn đã chia sẻ và cờ đơn thử.
- Sau phục hồi: khách khác không đọc được đơn, anon không đọc bảng riêng, khách không sửa thanh toán; cả khách và admin ứng dụng đều không được gọi job xóa liên hệ của chủ database.
- Retention xóa đúng 2 đơn hoàn tất/hủy quá 90 ngày; giữ đơn chưa hoàn tất dù đã cũ, đơn hoàn tất 89 ngày và đơn đúng mốc 90 ngày trong cùng transaction. Chạy lần hai không xóa thêm; không thay dấu xóa cũ, lời nhắn, thanh toán hoặc lịch sử.

Archive giả và báo cáo lần chạy gần nhất nằm trong `.backups/`, được gitignore. Chỉ [báo cáo không chứa thông tin khách](benchmarks/backup-restore.json) được lưu cùng repo. SHA-256 phát hiện thay đổi byte ngoài ý muốn, không thay thế mã hóa hoặc xác thực nguồn backup.

PGlite archive chỉ dùng phục hồi PGlite cùng phiên bản; **không phải file để import vào Supabase hay PostgreSQL server**. [API dump/load của PGlite](https://pglite.dev/docs/api).

## Backup thật trên gói Free

Supabase khuyến nghị Free xuất dữ liệu thường xuyên bằng CLI và giữ bản ngoài hệ thống. Database backup không chứa file đối tượng Storage, chỉ có metadata. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

Khi có quyền vận hành backend, agent thực hiện tuần tự:

1. Xác nhận project nguồn, version PostgreSQL và quyền đọc backup; dùng credential backend ở nơi lưu secret, không dùng publishable key và không đưa mật khẩu vào chat/repo/log. Không lấy backup dữ liệu khách bằng public RPC.
2. Xuất role/schema/data theo [quy trình Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), gồm `gd_private` và dữ liệu Auth cần cho khóa ngoại. Dùng snapshot nhất quán; kiểm tra mã thoát và archive đầy đủ trước khi đánh dấu thành công. Chưa có CLI/Docker/pg_dump được cấu hình ở workspace này.
3. Lưu bản mã hóa ở nơi riêng có quyền truy cập hạn chế, ngoài database/hosting; đặt chu kỳ và thời gian giữ theo dung lượng/ngân sách đã được chốt. Không đưa archive thật vào repo hoặc thư mục frontend/public. Chưa có nơi lưu ngoài được nối, chưa tạo lịch tự động.
4. Phục hồi vào sandbox cô lập, không ghi đè production hoặc staging đang có tài khoản. Không gửi email, tạo giao dịch tiền hoặc bật Cron/outbound integrations khi phục hồi. Với bản production, runtime/cờ dữ liệu từ nguồn vẫn là production; cần quy trình clone sandbox riêng được kiểm chứng trước khi nối frontend staging, không đổi metadata rồi coi dữ liệu khách là fixture.
5. Đối chiếu số dòng, constraints/index/RLS/owner, số tiền và kỉ niệm; chạy retention trên bản phục hồi trước khi cho phép sử dụng dữ liệu. Kiểm tra phạm vi dữ liệu cần khôi phục và tránh tái công khai thông điệp đã bị thu hồi sau thời điểm backup.
6. Lưu bằng chứng thời điểm backup, phạm vi, checksum, môi trường khôi phục, kết quả và thời gian phục hồi. SMTP/domain/Storage objects phải có quy trình riêng; database archive không tự khôi phục toàn bộ dịch vụ.

Các bước trên **chưa thực hiện trên Supabase thật**. Project hiện đóng nhận đơn. Không bật gói trả phí hoặc dùng credential qua kênh khác để vượt quyền dashboard đang bị chặn.

## Theo dõi retention thật

[retention-health.sql](supabase/retention-health.sql) chỉ đọc thông tin job, 10 lần chạy gần nhất, số đơn quá hạn và số dòng đã xóa vẫn còn thông tin giao hàng. Chỉ chủ database chạy; không biến thành RPC công khai. Output không lấy nội dung liên hệ, lời nhắn hoặc error message của job.

Lịch đã cấu hình ở production là `0 20 * * *`; với timezone UTC tương ứng 03:00 giờ Việt Nam. Phải đối chiếu timezone/job thực tế. `active=true` chỉ cho biết job được bật; cần lịch sử `succeeded` và số liên hệ quá hạn bằng 0 để nghiệm thu vận hành. Chưa có bằng chứng lịch sử job thật qua công cụ.

**BU-05 chưa hoàn thành:** đã đạt diễn tập phục hồi/retention local; còn backup ngoài hệ thống, phục hồi backend thật và lịch sử Cron.
