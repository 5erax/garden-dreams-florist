# Tiến độ big update

Ngày 09/10/2026, giờ Việt Nam. Chủ shop đã yêu cầu triển khai lần lượt 32 task; thứ tự vận hành → vườn kỉ niệm → toàn trải nghiệm. Cập nhật sau mỗi task/lát cắt được kiểm chứng. Chỉ tick task lớn khi đạt cả tiêu chí nghiệm thu và kiểm chứng môi trường thật.

## Hiện tại

- **Commerce/SEO ngày 10/10/2026:** thêm HTML catalog từ máy chủ, URL/slug riêng, sitemap/robots/canonical/Florist/Product, tìm không dấu, WOFF2 và cache; bỏ endpoint đặt demo 503. Kho/BOM/FEFO/hold/release/consume/waste nối admin/OMS; schema 013 đã cài staging và production. 149 tests/build qua; hosted stock rehearsal rollback qua, RLS đủ, không tồn/recipe giả. Main b3469ff / dpl_GDVp9TquQEFKJXZPdq7XFzwkwZ6C READY, exact SHA/alias đã kiểm; cover cleanup đã áp dụng sau deploy.
- **Không nâng trạng thái bằng tên feature:** inventory production vẫn tắt vì chưa được cấp tồn/công thức thật; guest cần bật Anonymous Auth qua dashboard. 40 chức năng một phần, 55 chưa triển khai sau đối chiếu mới; AT-02 chưa hoàn tất race/end-to-end. Chưa có browser/CWV/SEO crawler acceptance hoặc thông báo/coupon/QC enterprise.

- **Cập nhật mới nhất 10/10/2026:** bản commerce main 4d55f05 đã deploy production READY tại dpl_stKh6VYQsNj2BdLTSMtEZbYRGLxJ; xác minh exact SHA/alias. Backend production đã nâng cấp atomic 004→012 qua Supabase MCP được chủ shop cấp quyền. Một đơn cũ, 20 sản phẩm, ba dịch vụ giao active và trạng thái nhận đơn true có sẵn được giữ; không ghi nhận khoản thu, mọi bảng Garden Dreams có RLS.
- **Kiểm chứng:** 143 tests/build production qua; SQL acceptance hosted staging qua COD 0/30k/50k, VietQR UNPAID, idempotency, quyền khách/admin, fulfillment, kỉ niệm opt-in/revoke; toàn bộ dữ liệu thử rollback. Có regression migration thất bại rollback, giữ snapshot đơn/shop/catalog và không chạy lại nhầm.
- **Retention:** phát hiện production thiếu pg_cron/job; đã cài retention.sql hiện có. Job active=true, 03:00 Việt Nam, không có liên hệ quá hạn. Chưa có scheduled-run history và backup/restore hosted.
- **Chưa nghiệm thu:** browser bị saved permission block cho cả hai trang; Auth production/template recovery, UI và QR app ngân hàng còn mở. Không tick toàn bộ BU-02/03/04/05 hoặc khẳng định 90%. Hosted DB đã có album/cỡ/lịch/bàn vận hành/yêu cầu/sổ tiền; nhận đơn bằng tài khoản email vẫn cần nghiệm thu đầu-cuối.
- **LOC canonical:** 14.743 (+3.956 từ baseline 10.787), còn 11.044 tới mục tiêu thêm 15.000; SQL bundle trùng không được tính. Ưu tiên release chức năng hữu ích theo chỉ đạo chủ shop, không padding.

- **Phát hành giao diện ngày 10/10/2026:** lịch sử mua có owner scope rõ, tìm/lọc phần đã tải, cursor 20 đơn/cap 200, trạng thái tiền độc lập giao hàng và focus restoration. Tách tải account/admin/garden, có retry giữ phiên/giỏ. 53 tests và build production qua; chưa nghiệm thu browser/CWV.
- **Đã nhận đặc tả Word v1 và đối chiếu 95 chức năng:** file gốc, SHA-256, contract và traceability tại docs/product. Các quyết định COD/VietQR thủ công và kỉ niệm opt-in giữ nguyên; ngưỡng DEC còn mở chưa tự điền.
- **Nguồn nâng cấp đầy đủ ở branch feature/bu-01-isolated-staging, commit a825e76:** lịch giao/capacity, bàn xử lý đơn/ghi chú riêng, yêu cầu correction/hủy có quyền/retry/version/audit/retention, và gói upgrade staging 005→011. 98 tests + build staging qua. Database hosted chưa có migrations 006–011; không merge nguồn backend staging chưa nghiệm thu vào production.
- **Mục tiêu thêm 15.000 LOC còn mở:** baseline 10.787; nhánh nâng cấp hiện 13.131 (+2.344, còn 12.656), không tính thư viện/docs/build hoặc SQL bundle trùng. Chủ shop yêu cầu commit/deploy phần đã làm trước khi hết quota, sau đó tiếp tục backlog.

- **Ưu tiên mới: bản bán hàng đầu tiên để đưa vào dùng sớm.** Chủ shop đã xác nhận bán các mẫu/giá hiện có, địa chỉ, MB Bank/chủ tài khoản và ba mức phí giao. Các phần mở rộng big update để sau; không tự coi các gate còn thiếu là đã nghiệm thu. Xem [LAUNCH-STATUS.md](../LAUNCH-STATUS.md).

- **BU-01: hoàn thành — 1/32 task.** Database staging/API thật, cấu hình preview, cờ thử và deployment đã kiểm chứng theo tiêu chí SQL/SDK/Build/Ops.
- **BU-02: chưa cấu hình Gmail SMTP.** Chủ shop yêu cầu agent tự xử lý, đã chuẩn bị template/hướng dẫn và sửa callback; Supabase vẫn bị công cụ từ chối trong phiên mới. Việc tạo credential Google cần chủ tài khoản thao tác; không yêu cầu gửi secret trong chat.
- **BU-05: đang làm phần độc lập với SMTP.** Đã kiểm chứng phục hồi/retention local; backend thật và lịch sử Cron chưa kiểm chứng.
- **BU-07: mã nguồn album đã kiểm chứng local, chưa nghiệm thu Storage/UI thật.** Chuẩn bị trên branch staging trong lúc dashboard bị chặn; BU-06 vẫn là điều kiện nghiệm thu/phát hành.
- **BU-08–09: mã nguồn quản lý/chọn cỡ và snapshot đơn đã kiểm chứng local.** 36 tests, SDK local và build qua; chưa nghiệm thu UI/backend thật.
- **BU-03–04, BU-06 và BU-10–32: chưa bắt đầu.** Phụ thuộc các cổng nghiệm thu trong todo.md.
- Production tiếp tục đóng nhận đơn. Chưa merge/deploy thay đổi backend vào production.

## Nhật ký

### UX — Sửa bố cục và rút ngắn bước đặt hoa (09/10/2026)

- Hero không còn dịch chữ theo cuộn hoặc lời nhắc cuộn ghim đè CTA; xóa các padding hero cũ ở breakpoint. Footer thành ba vùng, địa chỉ rõ ràng và hàng chính sách tự xuống dòng.
- Hover nhẹ cho hoa/nút/tim, có giới hạn pointer và reduced motion. Giá, nút và trường checkout dễ đọc hơn.
- Nút thêm & đặt ngay đi thẳng sang một form giao hoa/người nhận/thanh toán; tổng có ảnh sản phẩm, phí và số tiền trước khi gửi. Giữ retry chống đơn trùng và không xóa hoa thêm sau yêu cầu cũ. VietQR thêm sao chép tài khoản/nội dung và tải ảnh mã.
- Xây phiên khách bằng Supabase anonymous Auth, giữ RLS theo UID. Chỉ hiện khi provider bật; lưu phiên thiết bị là opt-in, tài khoản thường vẫn giữ token trong bộ nhớ. Gắn email xác minh giữ cùng UID; đăng xuất phiên khách có cảnh báo mất đường truy cập.
- Nghiên cứu nghiệp vụ từ Bloom & Wild, 1-800-Flowers và Interflora được ghi tại SHOP-EXPERIENCE.md. Không sao chép cam kết giao/cutoff của các shop đó.
- 43 tests qua, mutation điều kiện lưu guest bị test bắt và đã khôi phục; build production qua. Production/staging vẫn tắt anonymous users; chưa kiểm chứng email upgrade/QR trong app ngân hàng hoặc đơn guest trên hosting. Browser đang lưu quyền từ chối; không vượt bằng công cụ khác. Chưa tăng bộ đếm BU hay mở nhận đơn thật.

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

### BU-08 — Quản lý cỡ bó trên mã nguồn staging

- Migration 007 thêm cỡ bổ sung: SKU duy nhất, tên/giá/trạng thái, parent bất biến, version và audit. Chỉ admin tạo/sửa; không xóa cỡ để giữ tham chiếu lịch sử. Khách chỉ đọc cỡ đang bật của sản phẩm đang bật.
- Màn hình admin nằm ngoài form sửa sản phẩm, có thêm/sửa/tắt, báo conflict version, khóa thao tác khi upload/lưu ở phần khác đang chạy. Giá sản phẩm cũ là cỡ Tiêu chuẩn; không tự tạo cỡ/giá giả hay đổi đơn cũ.
- 34 tests và build staging qua; tests kiểm tra SKU/giá/parent/quyền/ẩn cỡ tắt/version/audit. Backend chưa có 007 ẩn màn quản lý cỡ.
- Chưa tick BU-08: chưa áp dụng hosted migration, phiên admin/UI thật và cổng BU-06–07 còn mở. Tiến độ nghiệm thu vẫn 1/32. Tiếp tục BU-09 để lựa chọn cỡ có luồng đặt và snapshot hoàn chỉnh.

### BU-09 — Khách chọn cỡ và snapshot trên mã nguồn staging

- Migration 008 tính giá cỡ tại máy chủ, kiểm tra parent/trạng thái, chống dòng trùng, khóa đọc catalog; giữ idempotency/rate limit/quyền/quote của luồng cũ. Giỏ phân biệt product+cỡ, loại cỡ không còn bán mà không thay bằng Tiêu chuẩn. Cỡ cũ/null vẫn dùng giá sản phẩm.
- Nối lựa chọn trong chi tiết/giỏ/checkout/lịch sử; nút thêm nhanh mở chọn cỡ. Chi tiết dùng catalog hiện tại sau refresh, không giữ lựa chọn sản phẩm cũ để thêm cỡ đã tắt.
- Đơn snapshot tên/ảnh/dịp/cỡ/SKU/giá; kỉ niệm mới lưu metadata bất biến từ snapshot đầu đơn. Kỉ niệm cũ để trống metadata; public RPC không thêm nội dung ngoài lựa chọn chia sẻ cũ.
- **36 tests qua**, SDK local qua cả tạo/tắt cỡ, giá server và retry giữ snapshot; build staging qua. Test snapshot đổi tên/giá/dịp sau đặt, cỡ sai parent/tắt/ID sai kiểu, payload giá giả và metadata đều qua. Mutation gộp key các cỡ làm test fail; khôi phục rồi focused tests xanh. Backup/retention qua tới migration 008.
- Review sửa form SKU tương thích HTML pattern hiện tại, khóa form quản lý cỡ khi phần sản phẩm đang lưu/upload; chưa có UI thật để nghiệm thu.
- [PRODUCT-VARIANTS.md](../PRODUCT-VARIANTS.md) ghi contract/rollout. Chưa cài migrations 006–008 trên hosting trong bước này; backend báo capability để frontend mới không truy vấn bảng chưa có. BU-08/09 chưa tick, tiến độ nghiệm thu **1/32**.
- Code commit `acfe25463631a9519e918673916d77d58324e4ea` đã push; Vercel xác nhận `dpl_9QD9ScUzG5HJQKia4MH7hru15snF` READY đúng project/branch/SHA, target preview và alias staging cố định. PR #1 vẫn draft và Vercel check SUCCESS; không merge production.

### BU-26a — Chuẩn bị bộ sưu tập theo hướng thiết kế đã gọi

- Chủ shop gọi `design-taste-frontend` và `ponytail`; áp dụng vào storefront trong phạm vi mã nguồn staging. [DESIGN-AUDIT.md](../DESIGN-AUDIT.md) ghi audit trước sửa, dials 7/5/3 và những phần cần giữ từ mẫu gốc. Skill marketing không dùng để thiết kế lại admin/checkout.
- Giá card ghi rõ Tiêu chuẩn theo contract cỡ hiện có; không đổi giá, lựa chọn cỡ hoặc payload. Metadata/tên dài được wrap; tăng cỡ chữ, vùng chạm collection tối thiểu 44 px, search 16 px và focus nút ảnh nằm trong khung. Giữ frame vòm/hero/motion/reduced motion, đường dẫn, nội dung pháp lý và navigation.
- Chỉ thay markup tĩnh/CSS, không thêm dependency hoặc logic JS; không cần tests mới. Diff check và build staging qua. Tính tương phản màu đặc thấp nhất 4.76:1; chưa chứng minh contrast khi render thực tế. Cảnh báo JS chunk khoảng 683 kB vẫn còn.
- Chưa tick BU-26 và không đổi cổng phát hành hay thứ tự nghiệm thu. Browser/mobile/keyboard/Lighthouse, hosted migrations 006–008 và các cổng bản A/B vẫn còn mở. Tiến độ task lớn **1/32**, production tiếp tục đóng nhận đơn.
- Code commit `7f05e7318106493bcf3a86c4f75f466dfb42365d` đã push; Vercel xác nhận `dpl_DHs6uxhLQsAMjRKnyeRsyR2ARRSx` READY đúng project/branch/SHA, target preview và alias staging cố định. [Preview của thay đổi](https://garden-dreams-florist-jq6a0x0eo-dhas-projects-901181f4.vercel.app); PR #1 vẫn draft.

### Skills — Cài đặt và đánh giá kiến trúc theo tài liệu chủ shop

- Đã cài 4 skill upstream Vercel vào user skills qua installer có sẵn của Codex, pinned commit `063bee94c3f4df8453406c830b0a7df0f2860278`. Đã đọc entrypoints/rules cần dùng; không chạy script deploy bên thứ ba. Các hướng dẫn React/deploy có chồng lấp với plugin hiện tại; không xóa hoặc ghi đè plugin, không áp dụng máy móc quy tắc chỉ dành Next/RSC vào Vite.
- Tạo 10 skill nghiệp vụ trong `.agents/skills/`, cài junction vào user skills để chỉ duy trì một bản nguồn. Toàn bộ **14 SKILL.md qua validator**. Validator cần PyYAML; dependency này chỉ nằm trong tooling ngoài repo, không thêm vào ứng dụng. Tự nhận diện từ lượt tiếp theo; lượt này đã đọc và áp dụng trực tiếp các skill phù hợp.
- [FLOWER-COMMERCE-ROADMAP.md](../FLOWER-COMMERCE-ROADMAP.md) có đánh giá stack/capabilities, inventory skill, proposal schema, milestones, dependencies và test strategy. Tồn kho/công thức/loyalty/chi nhánh/lợi nhuận mới là proposal, chưa xây hoặc nghiệm thu.
- Không cài `ce-*`: tài liệu nêu chỉ dùng khi chọn Commerce Engine; dự án đang dùng Supabase/PostgreSQL. Không đổi backend/framework, đăng ký gói trả phí hoặc kết nối dịch vụ mới.
- Hoàn thành việc cài/tạo skill, không cộng vào 32 task nghiệp vụ. Giữ thứ tự và các cổng nghiệm thu đã được chốt.

### BU-26b / BU-09 — Chi tiết hoa, tạm tính và cỡ ngừng bán

- Màn chi tiết có đơn giá mỗi bó, tổng tạm tính từ helper giỏ hiện có, số lượng/cỡ và ghi rõ chưa gồm phí giao. Tổng dẫn xuất từ catalog/state hiện tại, không thêm price state hay đổi logic server.
- Không hiển thị giá Tiêu chuẩn thay cho cỡ đã ngừng bán. Select còn hiện khi cỡ đang chọn biến mất, kể cả cỡ bổ sung cuối cùng; có option báo trạng thái và cho chọn lại Tiêu chuẩn. Nút thêm vẫn bị khóa khi lựa chọn không hợp lệ.
- Chữ mô tả 14 px, select 16 px, nút số lượng 44 px, action wrap ở vùng hẹp; native dialog có scroll containment. Review theo guideline Vercel mới, giữ native semantics/focus và theme gốc.
- **39 tests qua**, gồm 3 tests render SSR mới, không listen HTTP hoặc truy cập backend hosted; build staging và diff check qua. Mutation phục hồi fallback giá sai làm test fail đúng kỳ vọng, đã khôi phục và chạy xanh. Diễn tập backup/retention với dữ liệu giả cũng qua trong full suite.
- Chưa kiểm chứng đổi cỡ/số lượng/refresh catalog hoặc layout trong browser. Không tick BU-09/26, hosted migrations vẫn chưa cài; bundle khoảng 684 kB vẫn cần tối ưu. Tiến độ nghiệm thu task lớn **1/32**.
- Đã push skill/roadmap commit `28cfc12` và source commit `8e92a752816a0404cf4bee04e89cbe7149d6bb20`. Vercel xác nhận `dpl_7M2HqqM1jU3RivPYf8nkts1bxHpH` READY đúng project/branch/SHA, target preview và alias staging; PR #1 vẫn draft, Vercel check SUCCESS. [Preview của lát cắt](https://garden-dreams-florist-n4yyot35o-dhas-projects-901181f4.vercel.app). Production chưa merge/mở bán.

### Production — Phát hành giao diện tương thích

- Chủ shop yêu cầu deploy sau khi preview chuyển sang Vercel login. Kiểm tra API public production chỉ đọc xác nhận shop đóng và RPC runtime chưa tồn tại (`PGRST202`); không chạy SQL hoặc đổi quyền/protection để vượt hạn chế dashboard.
- Nhánh `release/storefront-ui` lấy từ main và port các phần UI/helper tương thích từ staging. Giữ nguyên backend/Store/Auth/admin và migrations production 001–004; không phát hành runtime/migration 005 hay quản trị upload/cỡ. Product cũ vẫn dùng ảnh bìa và cỡ Tiêu chuẩn; checkout/helper/hiển thị snapshot cỡ optional được nối đầy đủ để không làm rơi payload.
- **26 tests qua** trên nhánh production release (khác bộ 39 tests staging); build production qua. Bundle xác nhận đúng endpoint production, không có ref staging; cảnh báo JS khoảng 671 kB. Bổ sung ignore `.backups/`; không ship environment hoặc archive giả.
- [PRODUCTION-UI-RELEASE.md](../PRODUCTION-UI-RELEASE.md) ghi phạm vi và rollback. Cửa hàng tiếp tục đóng; nghiệm thu toàn bộ BU-09/26/backend/email/browser vẫn còn mở. Đây là phát hành UI theo yêu cầu, không phải mở bán hoặc nghiệm thu toàn bộ big update.

### Production — Chuẩn bị nhận đơn và phục hồi lỗi đặt hoa

- Đã hoàn tất UI đặt đơn thử lại nguyên request khi mất xác nhận; giữ request qua đóng/mở modal trong cùng tab, khóa sửa nội dung lúc kết quả còn chưa rõ, có lối kiểm tra lại kể cả giỏ trống. SQL rejection chắc chắn cho sửa/refresh giá; IDEMPOTENCY_CONFLICT hướng khách về lịch sử. Logout/đổi tài khoản xóa request riêng; chỉ trừ số lượng của request đã lưu, giữ hoa vừa thêm vào giỏ. Không lưu PII vào localStorage. Escape không tự đóng native dialog khi thao tác đang bận.
- Địa chỉ thật, liên hệ điện thoại/Zalo và hướng dẫn giao hoa hiện ở checkout đóng cửa, thay cho yêu cầu đăng ký vào một luồng chưa nhận đơn. Admin có trường địa chỉ khi schema hỗ trợ; client cũ vẫn tương thích. Không ghi cuộc trao đổi thành đơn trong hệ thống.
- Chủ shop tự chạy `supabase/launch-shop.sql`; API public production kiểm chứng độc lập địa chỉ, MB Bank/chủ tài khoản và phí giao **0 / 30.000 / 50.000 VNĐ**, COD/VietQR bật, `accepting_orders=false`. Không sửa catalog hoặc đơn cũ, không tạo dữ liệu thử hosted. Khu vực xa cần admin xác nhận địa chỉ/phí trước khi nhận giao.
- **35 tests qua**, build production qua; mutation đổi owner guard làm 2 tests fail rồi khôi phục. Test SQL mới gồm guard owner/runtime, rerun không nhân dịch vụ, giữ nguyên catalog/shop đóng, anon không sửa shop và ba đơn giả dùng đúng bank/fee/UNPAID. Hai SSR fixtures tắt cả WebSocket Vite 8 để không xung đột cổng.
- Browser thử truy cập đúng production bị saved preference từ chối. Không đổi surface/cổng/CDP hoặc dùng private API để vượt chặn. Auth public cho thấy signup bật nhưng bắt xác nhận email; cấu hình SMTP/email thật và browser/payment acceptance vẫn chưa hoàn tất. Đây chưa phải tuyên bố cửa hàng nhận được đơn online thật.

### Production — Mua lại từ lịch sử

- Port frontend BU-19a / ACC-F03 từ staging a23e990; giữ backend/Store/orderColumns/migrations 001–004. Preview giá/cỡ hiện tại và thêm vào giỏ; không khôi phục dữ liệu người nhận/thiệp/lịch cũ, không tạo đơn từ nút mua lại.
- 68 production tests/build qua; bundle xác nhận endpoint production, không có ref staging. 12 helper và 3 SSR cases mới kiểm quyền lựa chọn, giỏ/limit, giá, PII và connection gate; availability mutation được bắt trên cùng nguồn staging.
- Staging BU-14 có sổ COD/VietQR và guarded upgrade 005→012, 134 tests/build qua tới BU-19a. LOC staging 14.515 (+3.728), còn 11.272; backend hosted chưa nâng cấp, browser/email/backup acceptance và mở nhận đơn còn chờ.

### Direct account-recovery release — 10/10/2026

Owner explicitly authorized direct production release without human review. Account forms now keep the selected action fixed while an Auth request is pending, clear stale messages on mode switches and label password recovery clearly. Password updates use the existing safe error mapper for network, password policy, same-password and expired-session errors; fields lock while saving. No database, SMTP, session persistence, payment or accepting-orders change. 75 production tests/build and 141 staging tests/build pass. Staging source commit 423345e.

Owner received staging recovery mail, establishing reported email delivery, but the body still used the signup template and landed in Spam. The local recovery template is correct. Saved browser permission still rejected the signed-in dashboard after linking the account; no bypass was used. Hosted template, callback/password update, production SMTP and real order acceptance remain unverified. Production remains closed for online orders.

## 2026-10-10 — Checkbox layout and storefront usability
- Owner reports Anonymous Sign-Ins enabled on production; not independently verified by this release. No Auth settings changed by the agent.
- Fixed the shared portal input selector: checkbox/radio controls no longer inherit full width, padding or text-field height. Applied the same exclusion to order-request forms and preserved required payment evidence/confirmation.
- Increased admin label/input readability, 44px confirmation label targets and visible keyboard focus. Payment summaries wrap at narrow widths.
- Compact hero, readable local-service information, consistent mobile service strip and gentle hover states respecting reduced motion. Reveal content stays visible before intersection instead of leaving a blank collection.
- Validation: production build passed; 26 focused payment/request/guest/product tests passed. Local browser fixture verified controls 20x20px, 390px layout without horizontal overflow, and successful checkbox interaction. Fixture removed before commit.
- No production order or payment mutation. Hosted guest checkout, SMTP recovery, real stock and concurrent-order acceptance remain unverified.

## 2026-10-10 — Florist motion refinement
- Applied design-taste-frontend, animate, emil-design-eng and review-animations. Reused installed Motion and native CSS; no new dependency or customer data mutation.
- Fixed stylesheet cascade: base styles now load before portal and commerce overrides. Mobile service rows and upgraded hero spacing actually take effect.
- Hero uses native CSS scroll timeline on supported desktop fine-pointer browsers; static fallback on older browsers/mobile/reduced-motion. Intro uses a full transform string. Six finite petals pause outside the viewport; continuous star/frame loops removed.
- New cards enter only after pointer-driven occasion/show-more actions, 200ms with at most 80ms stagger. Search, sort and keyboard filtering remain instant. Product content remains visible when starting-style is unsupported.
- Dialog pointer entry is 200ms; keyboard entry and dismissal stay immediate with native focus/Escape handling. Hover image feedback shortened to 240ms. Navigation underline animates scale instead of width; cart badge and toast use interruptible transitions.
- Verification: production build and 10 focused product/route/SEO tests passed. Local demo browser assertions passed for pointer/keyboard filters, keyboard/pointer dialogs, Escape, add-to-cart feedback, hero offscreen pause, reduced-motion, 390px no overflow and CTA within viewport. No real backend connected to demo.
- Animation review: Approve for this diff. Desktop native timeline and mobile fallback checked; real-device FPS, older-browser rendering and hosted order/payment acceptance not measured.

## 10/10/2026 — cold product repair, BloomLoader and 20 reference flowers

- Corrected missing occasion in public SSR snapshot, optional inline onClose, product-path home/catalog links and light-page header. Added root/cold-product regressions and verified local actual UI add-to-cart, root return and 390px layout.
- Reused BloomLoader across lazy pages and data panes; retained public snapshot on refresh, preloaded account/garden on intent; empty shipping after completion reports retry rather than endless loading. Accessible status and reduced-motion static petals.
- Prepared 20 distinct licensed image concepts, full descriptions and proposed prices, per-image attribution, public reference policy and non-purchasable UI/RPC. Seed is idempotent and preserves sale catalog/orders; admin explicitly activates reference models. No fake stock/recipes.
- Applied schema014 via official MCP to staging then production; hosted staging activation checked in a rollback transaction. Security advisor no ERROR, existing WARN documented. Production audit: 2 preserved orders, 20 active sale models, 5 placeholder photos, inventory false/zero recipes and batches.
- 155-test suite passed; added empty-shipping and root/product regression checks passed separately. Production build and npm audit production dependencies pass. Full final suite/deploy/seed outcome recorded below when complete.
- Wrote LAUNCH-AUDIT-2026-10-10.md: 95 Word requirements remain 40 partial/55 unimplemented. Vercel API verified Hobby plan; no commercial plan purchase, SMTP change, hosted browser access workaround or real purchase performed.

- Final validation: full suite 158/158, production/staging builds, 0 production dependency audit vulnerabilities, whitespace diff check pass. Reference photos inspected visually; runtime read before seed found two existing production orders, unchanged by DDL.

## Verified rollout — 10/10/2026

Production code 28157991aceb6af916f93d1ff6c0daf4aebc6d09 / dpl_Cfzt1i8jGacpPhBMDTVKdGGYyLYn READY, exact garden-dreams-florist.vercel.app alias and SHA verified via Vercel metadata. Staging c3af8015dca773a077687e5ddf30ff4b334e5a48 / dpl_9RRyZAYiBuxZgz3SMYW5AGTostHi READY, fixed preview alias verified. Both catalogs seeded only after corresponding assets were READY. Post-seed DB reads: 40 catalog models = 20 active sale + 20 inactive public references, 20 distinct reference image paths; production retains 2 existing orders and accepting_orders=true; staging has 0 orders and accepting_orders=false; inventory=false in both. Local compiled-template handler passed root/product/sitemap/404/HEAD/405. Hosted browsing/checkout/Google indexing were not tested. This evidence describes the code release; a subsequent documentation-only commit records it.
## Admin statistics and customer comparison — 10/10/2026

- Completed admin-only bounded business dashboard: Vietnam-day order/cash series, immutable ledger collections/refunds, current receivables, payment method selection, top flower snapshots, buyer/repeat-session counts, catalog SEO quality checks and aggregate CSV. No PII export or fabricated visitors/search rankings/profit.
- Added budget/sale-model filters and comparison of up to three bouquets, reusing ProductGallery and product selection/URLs; references remain unpurchasable. Mobile 390px verified filtering, selecting two models, comparison, and transition to product choice; fixed snapshot active fallback and comparison image overflow. Screenshot: workspace work/flower-comparison-mobile.png.
- Full suite 161/161 passed; changed selection/root tests passed again after UI correction; production build and whitespace checks passed. Schema015 applied officially to staging then production. Prod RPC verified two preserved orders, pending money excluded from collections; stage anon EXECUTE=false. Security advisor no ERROR, WARN documented.
- See docs/product/BUSINESS-DASHBOARD.md for money/date/privacy definitions and unconnected Google/traffic metrics. Deployment evidence appended after READY.

Verified rollout: production 72c47343a08455a379240c35cbb8446bd9d6f7a0 / dpl_3kwpwSVTLGqXSev877jH9RSThXn5 READY with garden-dreams-florist.vercel.app; staging 69f16056940955adbb78bec3e74162e9be335c23 / dpl_FfNYSZimuEJFJ2tQTMP7UhAfVUMM READY with fixed feature preview alias. Exact SHA/alias checked through Vercel metadata. Compiled local public handler passed home/product/sitemap/404/HEAD/405; production dependency audit 0 vulnerabilities. No hosted browser checkout or money action performed. This subsequent documentation-only commit records the verified feature release.

## Shared controls, admin continuity and inventory UX — 10/10/2026

- Replaced every native select and date field across storefront, checkout, history and administration with shared branded controls. Base UI handles accessible select/popover behavior; Vietnamese calendar displays DD/MM/YYYY and preserves named ISO form fields, required/disabled/min/max checks. Portals remain inside native modal dialogs. Pointer popups use brief opacity/scale; keyboard and reduced-motion preferences are respected. Search fields share brand styling.
- Fixed same-user SIGNED_IN/TOKEN_REFRESHED callbacks clearing the verified admin identity and remounting the workspace. Different accounts/sign-out still lose authority immediately; membership is rechecked. Persisted menu choice is scoped to account and valid backend capabilities; connection readiness prevents overwriting a saved menu before runtime metadata loads.
- Corrected heading/form alignment and redesigned inventory around four explicit tools, real-data metrics, recipe cards and guided empty states. Existing SQL validation, idempotent commands and actual inventory data remain intact. No stock/recipe values invented or stock enforcement toggled.
- Product selection still occurs in the inline popup. Public detail URL is retained for SEO/sharing; link copy replaces the top-of-detail navigation invitation.
- Production: 168/168 automated tests, build and dependency audit (0 vulnerabilities) pass. Added real subscription callback regression, select/ISO field SSR contract and invalid-date tests. Calendar module loads on demand. Main JS still triggers the >500 kB build warning.
- Browser QA was attempted on local test UI but rejected by a saved browsing block. No alternate browser, headless run or CDP bypass was used; popup interactions, focus/Alt+Tab and visual/mobile acceptance are not browser-verified. Staging build/deployment evidence follows after checks. No SQL migration or real purchase/payment performed.

Verified rollout: production 3df74378f4f3cdef59d83ad88aae994d5212de98 / dpl_9oXJPDH3zRsrNxzqxJAgJTK2nBy6 READY with garden-dreams-florist.vercel.app; staging 79fe401bf547e10e998f4b3c5129054a303095f3 / dpl_Do2L67EbCvyab4xbZdSNzwHMReLq READY with fixed feature preview alias. Exact SHA/alias checked via Vercel metadata. Both 168-test suites and builds passed. Browser visual, modal interaction and actual Alt+Tab acceptance remain blocked; auth subscription regression is tested in Node. This documentation-only commit records the functional release.

## SEO routing and catalog outage resilience — 10/10/2026

- Build now captures validated public catalog fields for the correct environment/project, moves the compiled HTML to private server/storefront-template.html and bundles both files with the function. dist/index.html is absent, removing filesystem precedence over the root rewrite. /index.html permanently redirects to /. Vite preview serves the same private template/snapshot rather than a broken root.
- Catalog reader deduplicates refreshes and keeps a 60-second last-good cache. On timeout/network/validation failure it uses last-good or environment-checked build snapshot, closes initial accepting_orders and labels degraded content; stale prices do not produce Product Offers or purchase CTA. Checkout still requires a fresh connected backend and server validation. Upstream deadline is 2.5 seconds. CDN adds 300-second SWR and one-day stale-if-error per official Vercel cache docs; no customer/session data is cached.
- Reference pages are noindex/follow and og:type=website, keep image attribution and have no Offer. Sitemap/root SEO listing include active sale models only: actual build snapshot = 20 sale + 20 reference, sitemap = 21 URLs.
- Twitter image follows product; removed guessed OG dimensions; static HTML now includes id=buy, matching the existing React purchase action anchor. Escaped JSON-LD retains Florist/Product structure.
- Production/staging: 172/172 tests, builds and compiled-file contract checks passed. Added cold/warm outage, recovery, concurrent refresh, no-offer fallback, reference SEO and response method tests. Build contract checks actual private/static files, manifest assets, valid JSON-LD and sitemap count instead of only calling the renderer.
- Local Vercel build failed on Windows spawn cmd.exe ENOENT; not claimed as a routing acceptance pass. CLI initially created a directory-named project; exact newly-created id/name/time verified, empty project removed and checkout relinked to existing garden-dreams-florist. Existing live project/data unaffected. Hosted HTML/browser/Core Web Vitals and Google indexing remain unverified under saved browsing restrictions. Deployment metadata/build logs are checked separately after rollout.

Hosted build caught a packaging omission: the prior .vercelignore excluded the entire scripts directory. Whitelisted only the two required build scripts; database/test/task files remain excluded. Failed deployments did not replace the current READY release.
