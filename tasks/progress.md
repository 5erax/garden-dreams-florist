# Tiến độ big update

Ngày 10/10/2026, giờ Việt Nam. Chủ shop đã yêu cầu triển khai lần lượt 32 task; thứ tự vận hành → vườn kỉ niệm → toàn trải nghiệm. Cập nhật sau mỗi task/lát cắt được kiểm chứng. Chỉ tick task lớn khi đạt cả tiêu chí nghiệm thu và kiểm chứng môi trường thật.

## Hiện tại

- **Đợt mở rộng thêm 15.000 LOC đang triển khai.** Baseline staging 10.787 dòng, mục tiêu tổng 25.787. Đến BU-19a đạt **14.515** (+3.728, còn 11.272). `npm run loc` loại thư viện, docs/build và SQL setup trùng; chưa đạt mốc.
- **BU-19a: mua lại từ lịch sử đã có mã/local**, dùng mẫu/cỡ/giá hiện tại, giữ giỏ, báo phần không còn bán hoặc vượt giới hạn; không chép PII/thiệp/lịch cũ. 12 helper + 3 SSR tests qua, toàn bộ staging 134 tests/build qua. Chưa kiểm browser/hosted, cổng BU-19 tổng vẫn mở.
- **BU-14: mã nguồn/local sổ đối soát đã xong.** Thu/hoàn toàn phần, số dư owner, chứng từ admin, retry/version/reference, báo cáo ngày Việt Nam và LEGACY riêng. 10 SQL + 8 helper tests, kiểm upgrade/rollback qua; staging build qua. Xem [PAYMENT-LEDGER.md](../PAYMENT-LEDGER.md). Migration 012 chưa cài hosted; không tick nghiệm thu toàn task.
- **Production mua lại từ lịch sử đã phát hành qua PR #6**, main ef50fed00c76b80d84805c799020081fbb526e98. Vercel dpl_DEsqsg37P3tQJAX8gKxbSLf9i6A8 READY đúng SHA/target/alias garden-dreams-florist.vercel.app. 68 production tests/build qua; giữ backend 001–004, chưa mở nhận đơn.
- **Đã nhận và đối chiếu tài liệu Word nghiệp vụ v1**: lưu nguyên bản/SHA-256 và traceability đủ 95 chức năng tại docs/product. Nguồn điều chỉnh backlog BU/FC, không tự chốt các DEC còn mở hoặc thay quyết định COD/VietQR/kỉ niệm của chủ shop.
- **BU-13: mã nguồn/local correction tên/điện thoại và yêu cầu hủy đã xong.** Khách gửi/rút/theo dõi; admin duyệt theo trạng thái hiện tại, UUID/version/audit không PII. Đổi địa chỉ cần re-quote nên chưa áp trực tiếp. Hủy không tự hoàn tiền. Review đã phát hiện và sửa free-text retention/rate-limit race; 8 SQL và 8 helper tests qua, mutation bỏ guard địa chỉ bị test bắt. Migration 011 chưa cài hosted.
- **ACC-F03 / BU-32: lịch sử mua và tách tải route đã xong local.** Owner scope explicit, tìm/lọc phần đã tải, phân trang 20/cap 200, focus trở lại đơn. Route retry giữ session/cart. 8 history + 2 route tests qua; JS ban đầu 678,58 kB, chưa đo Core Web Vitals/browser thật.
- **Gói upgrade staging 005→011 đã chuẩn bị**, đúng project staging, một transaction, từ chối production/nhầm project/schema không đúng baseline; 3 test kiểm guard/rollback/giữ đơn cũ qua. File này khác fresh staging-setup.sql và chưa được chạy trên hosting.
- **BU-12: bàn xử lý đơn đã có mã nguồn/local**, hàng đợi theo ngày/trạng thái, tìm mã, cursor, tổng tiền cần thu/đã đối soát và ghi chú nội bộ append-only/idempotent. RLS ngăn khách xem ghi chú; queue không trả thiệp, địa chỉ, số điện thoại hoặc ngân hàng. 69 tests và build staging qua; migration 010 chưa cài hosted.
- **BU-10 và phần giữ chỗ BU-11: mã nguồn/local đã xong**, chưa nghiệm thu hosted/browser. Admin có ca/ngày nghỉ/cutoff/sức chứa, checkout dùng lịch server theo capability. Xác nhận kiểm tra chỗ trong transaction; hủy nhả chỗ theo trạng thái, tính cả đơn cũ đã xác nhận. Migration 009 mặc định lịch tự động tắt, giữ luồng manual tương thích backend cũ.
- Kiểm chứng lát cắt mới: **65 tests** và build staging qua. Mutation bỏ kiểm tra ca đầy bị 3 test bắt, đã khôi phục. Chưa thử hai connection PostgreSQL thật chạy đồng thời; PGlite đã thử hai intent tranh chỗ và rollback/version/retry, không thay nghiệm thu concurrency hosted.

- **Ưu tiên mới: bản bán hàng đầu tiên để đưa vào dùng sớm.** Chủ shop đã xác nhận bán các mẫu/giá hiện có, địa chỉ, MB Bank/chủ tài khoản và ba mức phí giao. Các phần mở rộng big update để sau; không tự coi các gate còn thiếu là đã nghiệm thu. Xem [LAUNCH-STATUS.md](../LAUNCH-STATUS.md).

- **BU-01: hoàn thành — 1/32 task.** Database staging/API thật, cấu hình preview, cờ thử và deployment đã kiểm chứng theo tiêu chí SQL/SDK/Build/Ops.
- **BU-02: chưa cấu hình Gmail SMTP.** Chủ shop yêu cầu agent tự xử lý, đã chuẩn bị template/hướng dẫn và sửa callback; Supabase vẫn bị công cụ từ chối trong phiên mới. Việc tạo credential Google cần chủ tài khoản thao tác; không yêu cầu gửi secret trong chat.
- **BU-05: đang làm phần độc lập với SMTP.** Đã kiểm chứng phục hồi/retention local; backend thật và lịch sử Cron chưa kiểm chứng.
- **BU-07: mã nguồn album đã kiểm chứng local, chưa nghiệm thu Storage/UI thật.** Chuẩn bị trên branch staging trong lúc dashboard bị chặn; BU-06 vẫn là điều kiện nghiệm thu/phát hành.
- **BU-08–09: mã nguồn quản lý/chọn cỡ và snapshot đơn đã kiểm chứng local.** 36 tests, SDK local và build qua; chưa nghiệm thu UI/backend thật.
- **BU-03–04, BU-06 và các task còn lại chưa nghiệm thu.** BU-10–13 và phần độc lập ACC-F03/BU-32 đã có local như trên; vẫn giữ các cổng trong todo.md.
- Production tiếp tục đóng nhận đơn. Chưa merge/deploy thay đổi backend vào production.

## Nhật ký

### UX — Sửa bố cục và rút ngắn bước đặt hoa (09/10/2026)

- Hero không còn dịch chữ theo cuộn hoặc lời nhắc cuộn ghim đè CTA; xóa các padding hero cũ ở breakpoint. Footer thành ba vùng, địa chỉ rõ ràng và hàng chính sách tự xuống dòng.
- Hover nhẹ cho hoa/nút/tim, có giới hạn pointer và reduced motion. Giá, nút và trường checkout dễ đọc hơn.
- Nút thêm & đặt ngay đi thẳng sang một form giao hoa/người nhận/thanh toán; tổng có ảnh sản phẩm, phí và số tiền trước khi gửi. Giữ retry chống đơn trùng và không xóa hoa thêm sau yêu cầu cũ. VietQR thêm sao chép tài khoản/nội dung và tải ảnh mã.
- Xây phiên khách bằng Supabase anonymous Auth, giữ RLS theo UID. Chỉ hiện khi provider bật; lưu phiên thiết bị là opt-in, tài khoản thường vẫn giữ token trong bộ nhớ. Gắn email xác minh giữ cùng UID; đăng xuất phiên khách có cảnh báo mất đường truy cập.
- Nghiên cứu nghiệp vụ từ Bloom & Wild, 1-800-Flowers và Interflora được ghi tại SHOP-EXPERIENCE.md. Không sao chép cam kết giao/cutoff của các shop đó.
- 43 tests qua, mutation điều kiện lưu guest bị test bắt và đã khôi phục; build production qua. Production/staging vẫn tắt anonymous users; chưa kiểm chứng email upgrade/QR trong app ngân hàng hoặc đơn guest trên hosting. Browser đang lưu quyền từ chối; không vượt bằng công cụ khác. Chưa tăng bộ đếm BU hay mở nhận đơn thật.
- [PR #4](https://github.com/5erax/garden-dreams-florist/pull/4) đã merge; production commit `18e28ae6a10a6169d22a704daf84e70c954fbfaf`. Vercel API xác nhận deployment `dpl_Ds67hnGVzJyMTruQ6o4QCnsfzH5B` READY, target production, đúng project/SHA; alias [website](https://garden-dreams-florist.vercel.app) trỏ đúng deployment này.
- Đồng bộ bản sửa production vào branch staging, giữ runtime/capability checks và callback Auth. 56 tests qua, build staging qua (JS 687.42 kB). Không đưa các migration album/cỡ chưa nghiệm thu lên production.

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
- PR #2 đã merge đúng head đã kiểm tra; main commit `7c7ab4aa1402b87a03567ca9245ce6538169d85a`. Vercel xác nhận production `dpl_9Hxegoxa4MfJkw1ZeLgUc9RwazgM` READY đúng project/branch/SHA/target và alias [garden-dreams-florist.vercel.app](https://garden-dreams-florist.vercel.app). Project giữ Standard Protection và không có password protection; không đổi cấu hình bảo vệ preview. Không dùng fetch website/bypass để thay kiểm thử browser.
- Đồng bộ main về branch staging: chỉ thêm biên bản phát hành/progress, không đổi source staging đã kiểm tra. Full update PR #1 vẫn draft; không phát hành backend hoặc đánh dấu các task QA còn mở là hoàn tất.

### Production — Chuẩn bị nhận đơn và phục hồi lỗi đặt hoa

- Đã hoàn tất UI đặt đơn thử lại nguyên request khi mất xác nhận; giữ request qua đóng/mở modal trong cùng tab, khóa sửa nội dung lúc kết quả còn chưa rõ, có lối kiểm tra lại kể cả giỏ trống. SQL rejection chắc chắn cho sửa/refresh giá; IDEMPOTENCY_CONFLICT hướng khách về lịch sử. Logout/đổi tài khoản xóa request riêng; chỉ trừ số lượng của request đã lưu, giữ hoa vừa thêm vào giỏ. Không lưu PII vào localStorage. Escape không tự đóng native dialog khi thao tác đang bận.
- Địa chỉ thật, liên hệ điện thoại/Zalo và hướng dẫn giao hoa hiện ở checkout đóng cửa, thay cho yêu cầu đăng ký vào một luồng chưa nhận đơn. Admin có trường địa chỉ khi schema hỗ trợ; client cũ vẫn tương thích. Không ghi cuộc trao đổi thành đơn trong hệ thống.
- Chủ shop tự chạy `supabase/launch-shop.sql`; API public production kiểm chứng độc lập địa chỉ, MB Bank/chủ tài khoản và phí giao **0 / 30.000 / 50.000 VNĐ**, COD/VietQR bật, `accepting_orders=false`. Không sửa catalog hoặc đơn cũ, không tạo dữ liệu thử hosted. Khu vực xa cần admin xác nhận địa chỉ/phí trước khi nhận giao.
- **35 tests qua**, build production qua; mutation đổi owner guard làm 2 tests fail rồi khôi phục. Test SQL mới gồm guard owner/runtime, rerun không nhân dịch vụ, giữ nguyên catalog/shop đóng, anon không sửa shop và ba đơn giả dùng đúng bank/fee/UNPAID. Hai SSR fixtures tắt cả WebSocket Vite 8 để không xung đột cổng.
- Browser thử truy cập đúng production bị saved preference từ chối. Không đổi surface/cổng/CDP hoặc dùng private API để vượt chặn. Auth public cho thấy signup bật nhưng bắt xác nhận email; cấu hình SMTP/email thật và browser/payment acceptance vẫn chưa hoàn tất. Đây chưa phải tuyên bố cửa hàng nhận được đơn online thật.
- PR #3 đã merge đúng head đã kiểm tra; main commit `5aa7ab4098df4c00d429c90ef8fb479abbd261d3`. Vercel production `dpl_AsntM9NEjZ4JUdK2DizsaBprpTcY` **READY**, đúng project/target/branch/SHA và alias [garden-dreams-florist.vercel.app](https://garden-dreams-florist.vercel.app). Không thay bảo vệ preview hoặc mở nhận đơn. Giữ hướng dùng web để chọn hoa và liên hệ shop trong lúc hoàn tất email/QA.
- Đồng bộ release về staging, giữ đủ runtime/capability/auth guards và quản trị album/cỡ. **48 tests staging qua** sau merge, gồm backup/restore/retention dữ liệu giả; build staging qua, bundle khoảng 688 kB. Không coi backup local hoặc SSR là nghiệm thu môi trường hosted/browser. PR #1 vẫn draft.

### BU-14 — Sổ đối soát trên mã nguồn staging

- 117 tests và staging build qua; review độc lập không có blocker. Mutation amount=1 và đảo guard tham chiếu bị bắt; đã khôi phục. Ranh giới 00:00 giờ Việt Nam được kiểm thu/hoàn tại trước/đúng/sau cutoff ngày.
- Bundle staging 005→012 giữ transaction/guard, thử lỗi cuối rollback cả schema trung gian; backfill không giả ngày thu. Production vẫn ở release UI PR #5, không phát hành backend mới.
- LOC canonical 14.160 (+3.373), còn 11.627 để đạt thêm 15.000; chưa hosted/browser/concurrency đa connection. Tiến độ nghiệm thu toàn task vẫn 1/32.

### BU-14 — Preview và BU-19a mua lại từ lịch sử

- BU-14 commit e50e9870607b5d49370a998cc173340e1e49f75d đã push; Vercel dpl_9RewQtKtiubi5z4L16wAUWxihCQ8 READY đúng project/SHA và alias staging. Migration 012 chưa chạy hosted.
- BU-19a tái sử dụng cartChoice/cartKey/normalizeCart và checkout; kiểm preview mua lại/giá/quantity/giỏ/PII, mutation availability guard bắt lỗi. Không thêm dependency hoặc đổi backend. Full staging 134 tests/build qua.
- BU-14b report validation chặn số tiền mất độ chính xác/khác kỳ/net không khớp trước hiển thị; không đổi định nghĩa thu-hoàn hoặc payload SQL. Không dùng tổng thu làm lợi nhuận.

### Phát hành BU-19a — production và staging

- PR #6 đã merge đúng head ec316abbf617bcd684e0d7ddd327e8c009d0007b; main ef50fed00c76b80d84805c799020081fbb526e98. Vercel production dpl_DEsqsg37P3tQJAX8gKxbSLf9i6A8 READY, xác nhận đúng project/SHA/target và domain garden-dreams-florist.vercel.app.
- Staging source a23e9900e19a83b524916761f506e29cdc552eca đã deploy READY dpl_2xjXJy168fYmET2i6q8ZxVh5qPjn. Mã mua lại trên hai nhánh giống nhau; giữ backend/env/migrations staging riêng, không merge client production vào staging.
- Cập nhật RELEASE-STATUS và traceability; 134 staging tests / 68 production tests và hai build đã qua. Browser/callback/payment/SDK hosted/concurrency chưa kiểm; shop chưa mở nhận đơn, BU-14 chưa có migration thật. Không coi READY là nghiệm thu nghiệp vụ.

### Bản sử dụng sớm — ảnh và nhận diện, 10/10/2026

- Hoàn thành thay favicon mặc định bằng dấu hoa cùng hệ biểu tượng cửa hàng; tên file mới tránh cache cũ. Ảnh nền riêng Garden Dreams được tạo bằng imagegen, WebP 158.882 byte; ảnh chia sẻ JPEG 259.359 byte, metadata URL tuyệt đối/alt/kích thước. Giữ ảnh sản phẩm đã được chủ shop chấp thuận. Nền hero dùng ảnh thay autoplay video.
- 68 production tests và production build qua; staging tests/build cũng qua sau đồng bộ. Kiểm định dạng/kích thước ảnh và asset trong build; review không đổi backend, quyền hay tiền. Không dùng kết quả này thay browser QA.
- PR #7 merge head `2d98ee3f59b16171cd627137efb2f23a0782c579`; main `dc894b91232df887798c0efa314043dce858b454`. Vercel `dpl_HmW3jZc72jV4gA8jLsAuEoystWLE` READY, đúng target production/SHA/branch và alias garden-dreams-florist.vercel.app.
- Hai lần mở cửa hàng và dashboard staging đều bị Browser Use từ chối vì saved permission; không đi vòng. Chưa chạy hosted migrations 006–012, chưa nghiệm thu SMTP/customer/admin, chưa mở accepting_orders. Yêu cầu 90% là mục tiêu, chưa có bằng chứng đạt tỷ lệ đó.

### Tiếp tục khi browser bị chặn — cách ly phiên quản trị

- Không dừng phát triển: sửa Store lưu ID tài khoản đã xác thực admin và so với phiên hiện tại; remount AdminWorkspace khi đổi tài khoản hoặc quyền để bỏ danh sách đơn, thông tin liên hệ, lựa chọn và draft cũ. RLS vẫn là kiểm soát backend, không cấp thêm quyền.
- Kiểm caller Store/AdminPortal/OrderDetail và effect cleanup. 3 regressions: kết quả quyền đến muộn, logout/đổi chủ, mất/lấy lại quyền và giao diện tài khoản chưa xác thực. Mutation bỏ so khớp ID bị bắt, đã khôi phục. 137 staging tests/build và 71 production tests/build qua.
- LOC canonical 14.566 (+3.779 từ baseline 10.787), còn 11.221 để đạt mục tiêu thêm 15.000. Task toàn bộ/90% và hosted acceptance chưa được xác nhận. Không đổi trạng thái nhận đơn hoặc cài migration production mới.
- PR #8 đã merge head `2ba84cd643b2a39c4fdb7c5eb45d1b2b7004cfc7`; main `ae826d81ed1a70265033c9b848b58fc61d0fefbb`. Vercel `dpl_GhkUhkr2cq6NPAWBxFFXZA5AWWkR` READY, đúng production/SHA và alias garden-dreams-florist.vercel.app. Nguồn staging `fad76bd`; schema/auth backend và nhận đơn giữ nguyên.

### Nâng cấp staging thủ công — kết quả chủ project, 10/10/2026

- Chủ project chạy truy vấn kiểm tra chỉ đọc và gửi ảnh: projectRef tgvozhrkolcpszyyrgth, environment staging, variants/delivery/payments NULL. Sau hướng dẫn chạy staging-upgrade-005-to-012.sql, gửi ảnh kết quả upgraded_environment với productAlbum, orderRequests và variantOrders true. Kết quả cuối của file nằm sau COMMIT; ảnh JSON bị cắt nên chưa xác nhận đủ mọi feature/projectRef sau nâng cấp hoặc luồng SDK/Auth/UI.
- Bước tiếp theo: Gmail App Password và Custom SMTP chỉ trên staging, sau đó URL callback/template/đăng ký-khôi phục và ca thử. Không yêu cầu gửi secret qua chat. Production không được nâng cấp hoặc mở nhận đơn bởi thao tác staging này.
- Chủ project báo “đã lưu smtp” trên staging. Ghi nhận cấu hình đã lưu theo báo cáo của chủ project; chưa nghiệm thu gửi/nhận, callback, khôi phục hoặc email tới hai tài khoản. Bước tiếp theo là URL Configuration và email templates, rồi gửi thử qua luồng đăng ký của website.
