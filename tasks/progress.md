# Tiến độ big update

Ngày 09/10/2026, giờ Việt Nam. Chủ shop đã yêu cầu triển khai lần lượt 32 task; thứ tự vận hành → vườn kỉ niệm → toàn trải nghiệm. Cập nhật sau mỗi task/lát cắt được kiểm chứng. Chỉ tick task lớn khi đạt cả tiêu chí nghiệm thu và kiểm chứng môi trường thật.

## Hiện tại

- **BU-01: hoàn thành — 1/32 task.** Database staging/API thật, cấu hình preview, cờ thử và deployment đã kiểm chứng theo tiêu chí SQL/SDK/Build/Ops.
- **BU-02: chưa cấu hình Gmail SMTP.** Chủ shop yêu cầu agent tự xử lý, đã chuẩn bị template/hướng dẫn và sửa callback; Supabase vẫn bị công cụ từ chối trong phiên mới. Việc tạo credential Google cần chủ tài khoản thao tác; không yêu cầu gửi secret trong chat.
- **BU-05: đang làm phần độc lập với SMTP.** Đã kiểm chứng phục hồi/retention local; backend thật và lịch sử Cron chưa kiểm chứng.
- **BU-07: mã nguồn album đã kiểm chứng local, chưa nghiệm thu Storage/UI thật.** Chuẩn bị trên branch staging trong lúc dashboard bị chặn; BU-06 vẫn là điều kiện nghiệm thu/phát hành.
- **BU-03–04, BU-06 và BU-08–32: chưa bắt đầu.** Phụ thuộc các cổng nghiệm thu trong todo.md.
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
- Đã push commit `c969382df3ae39ebe6cb2e87e197465375526a5a`; Vercel xác nhận `dpl_G6tgnuDBwABzjCrD97vYYaEkffFu` READY, đúng project/branch/commit, Vercel check trên PR SUCCESS. [Alias staging cố định](https://garden-dreams-florist-git-feature-ed38b9-dhas-projects-901181f4.vercel.app) được trả về từ metadata deployment; hướng dẫn SMTP đã cập nhật Site URL/redirect tương ứng.
- Tiến độ vẫn **1/32 task**. BU-02 chưa tick; BU-03 chờ Auth/SMTP thật và dữ liệu kiểm thử của chủ shop.

### BU-02c — Hướng dẫn thao tác Gmail cho lần cấu hình đầu

- Chủ shop báo chưa biết cấu hình; chưa coi câu trả lời là đã cấu hình SMTP.
- Bổ sung 4 bước cụ thể vào AUTH-EMAIL-SETUP.md: bật xác minh 2 bước/tạo App Password, điền SMTP staging, Site URL/redirect, template và đăng ký thử. Dẫn link Google/project staging chính xác và giải thích tài khoản staging tách production.
- Đối chiếu tài liệu chính thức Google/Supabase; chỉ thay đổi hướng dẫn, không chạy lại tests cho nội dung này. Chưa thao tác dashboard hoặc gửi email thật; tiến độ vẫn 1/32.

### BU-05a — Diễn tập phục hồi và retention độc lập

- Chủ shop yêu cầu agent tự làm, không giao lại thao tác cấu hình thường lệ. Kiểm tra phiên trình duyệt hiện không có tab; mở project staging bằng công cụ trình duyệt bị từ chối do saved user permission chặn supabase.com. Không thử browser/API/credential khác để vượt hạn chế này.
- Tiếp tục BU-05 vì chỉ phụ thuộc BU-01. Test mới xuất archive database giả xuống đĩa, đóng nguồn và nạp vào database local mới; kiểm tra checksum, đơn/giá snapshot, kỉ niệm, RLS, quyền thanh toán và quyền retention sau phục hồi.
- Kiểm tra mốc 89/90/91 ngày, đơn đang xử lý dù cũ, đơn đã xóa và chạy job lần hai; giữ thiệp/lịch sử. Test focused qua với 6 đơn/3 kỉ niệm; archive chỉ gồm dữ liệu giả và nằm trong thư mục gitignored.
- Toàn bộ **28 tests qua** sau thay đổi; [báo cáo diễn tập](../benchmarks/backup-restore.json) ghi môi trường local, migrations, checksum, phạm vi đã qua/chưa kiểm. Không chạy lại frontend build vì chỉ thay test và tài liệu/SQL health; frontend không đổi.
- Thêm SQL kiểm tra sức khỏe Cron chỉ đọc số liệu vận hành, không xuất PII; tài liệu backup thật ghi rõ Auth/Storage/runtime cần xử lý riêng. SQL health chưa chạy trên backend thật.
- Chưa tick BU-05: còn backup ngoài hệ thống, restore backend thật và Cron history. Không thay đổi Gmail/SMTP, không tạo phiên khách hoặc đơn trên Supabase. Tiến độ task lớn vẫn 1/32.

### BU-07a/b — Quyền ảnh và album trên mã nguồn staging

- Sau khi chủ shop sửa quyền và khởi động lại, công cụ vẫn từ chối Supabase do saved permission; không dùng đường khác để vượt chặn. Tiếp tục phần mã nguồn theo yêu cầu tự làm. Kế hoạch/todo ghi rõ BU-06 vẫn là cổng phát hành, không đổi tiêu chí nghiệm thu.
- Migration 006 thêm album tối đa 8 ảnh, đồng bộ bìa và bucket public dành riêng cho ảnh sản phẩm, 2 MB/WebP, chỉ admin upload UUID mới. Ảnh đơn/kỉ niệm cũ giữ snapshot; ứng dụng không ghi đè/xóa file. Migration từ chối bucket xung đột, không biến bucket riêng tư thành public.
- Runtime báo khả năng album/Storage: frontend mới giữ hành vi sửa sản phẩm cũ trên backend 005 đang chạy; không gửi cột `images` khi backend chưa có. Không chạy migration trên hosted backend trong bước này.
- Admin có upload/nén/đổi thứ tự/bỏ ảnh, lưu theo version; khách có thumbnail/chọn ảnh/placeholder ảnh lỗi. Dùng Canvas/native controls và SDK đã cài, không thêm dependency.
- **33 tests qua**, build staging qua; SDK local kiểm tra album/bìa/quyền/version/snapshot cùng luồng đơn/thanh toán/chia sẻ. Mutation tăng giới hạn lên 80 làm test 9 ảnh thất bại đúng kỳ vọng; đã phục hồi migration và chạy lại xanh. Diễn tập backup/retention vẫn qua với migration 006, báo cáo aggregate được cập nhật.
- Review giữ ảnh cũ bên ngoài khi album trống, khóa thay bản nháp trong lúc upload, không bật upload với fixture thiếu Storage. Canvas unit test dùng stub; chưa chứng minh codec thật.
- [PRODUCT-ALBUMS.md](../PRODUCT-ALBUMS.md) ghi phạm vi và nghiệm thu còn mở. Storage file API/policy thật, UI/mobile/keyboard và BU-06 chưa qua; không tick BU-07. Upload chưa lưu được giữ lại, chưa có cleanup orphan tự động. Tiến độ task lớn vẫn **1/32**.
- Đã push code commit `abf29c04ce472d14b4ba7200343259a320d44dfe`; Vercel xác nhận deployment `dpl_2hLjQjfxds2W5FxbFbjibNvR2P3B` READY, đúng project/branch/SHA, target preview và alias staging cố định. PR #1 vẫn draft, Vercel check SUCCESS. Backend hosted chưa có 006 nên màn upload được ẩn đúng kế hoạch; không coi deployment READY là đã nghiệm thu album.
