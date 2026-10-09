- [x] identity: đã viết đăng nhập/đăng ký/khôi phục và kiểm tra role/RLS; chờ kiểm thử email Supabase thật.
- [x] shop-store: shop/catalog động, chỉnh sửa admin, validation và giá snapshot.
- [x] fulfillment: dịch vụ/khu vực/phí/khung giờ, kiểm tra dịch vụ hoạt động.
- [x] orders: idempotency, giá máy chủ, tiến trình và lịch sử riêng theo khách; kiểm thử local.
- [x] payments: COD/VietQR, admin xác nhận/audit, khách không sửa paid; chờ quét QR ngân hàng thật.
- [x] memories: một dấu mỗi đơn đã giao/paid, link, opt-in, revoke; đã thử một triệu dấu giả.
- [x] portals: đã viết quản trị, lịch sử/tracking, vườn và thiệp; CSS responsive/accessibility.
- [x] release checks: SQL/shared helpers tests, SDK local integration, build, dependency audit; hướng dẫn Supabase và SQL setup.
- [x] release external: đã push và deploy production READY; cấu hình URL/publishable key production đã lưu.
- [x] real backend connection: chủ project chạy SQL; API thật xác nhận catalog/vườn và chặn anon khỏi bảng riêng. Chủ shop xác nhận đã chạy SQL cấp admin.
- [x] retention scheduling: chủ shop xác nhận đã chạy retention.sql, job active=true; chưa kiểm chứng lịch sử job chạy.
- [ ] real backend launch: kiểm chứng đăng nhập/admin và luồng đơn thật bằng dữ liệu thử, cấu hình SMTP cho khách, theo dõi Cron, kiểm tra QR ngân hàng.
- [ ] browser QA: kiểm tra UI desktop/mobile sau khi quyền truy cập được mở lại.

## Big update — đã được yêu cầu triển khai ngày 09/10/2026

Ưu tiên: vận hành → vườn kỉ niệm → toàn bộ trải nghiệm. `S`: khoảng 1–2 file chính; `M`: khoảng 3–5 file chính. File mới được nêu theo trách nhiệm, tên chính thức chốt khi triển khai. Nếu một task vượt phạm vi M, tách tiếp trước khi code; mỗi task phải có API/UI nối được và kiểm tra thích hợp. Mọi quyền/tiền được kiểm tra trên backend.

Quy ước kiểm chứng:

- `SQL`: test Postgres/RLS/RPC có đầu vào lỗi và quyền đối nghịch; test tập trung trước `npm test`.
- `SDK`: tích hợp Supabase thật trên môi trường thử với hai khách và vai trò liên quan.
- `UI`: trình duyệt ở viewport phù hợp, bàn phím, lỗi mạng/trạng thái rỗng; không thay bằng build.
- `Build`: `npm run build`; `Perf`: đo có thiết bị/mạng/dataset ghi rõ.
- `Ops`: kiểm tra cấu hình/job/log hoặc phục hồi thật; ghi kết quả, không chỉ tick dựa vào tài liệu.

### Giai đoạn 0

### BU-01 — Môi trường thử và dữ liệu thử — M

Trạng thái: hoàn thành theo tiêu chí SQL/SDK/Build/Ops của task. Preview READY tại commit `9a2014a`; UI và Auth/SMTP thật vẫn thuộc BU-02–04. Theo dõi bằng chứng tại [progress.md](progress.md).

- [x] Preview/staging dùng cấu hình riêng; có cờ test không tính vào doanh thu/kỉ niệm mua thật.
- [x] Fixture và script không thể vô tình đổ dữ liệu giả vào production.
      Phụ thuộc: không. File: migration mới, config mẫu, seed test, hướng dẫn deploy. Kiểm: SQL, SDK, Build, Ops.

### BU-02 — Email xác thực và callback — M

Trạng thái: chủ shop chọn Gmail cho staging, sau đó yêu cầu agent tự xử lý toàn bộ. Đã chuẩn bị hướng dẫn/template tại [AUTH-EMAIL-SETUP.md](../AUTH-EMAIL-SETUP.md), sửa callback về Góc của tôi và thông báo link hết hạn. Quyền dashboard Supabase vẫn bị trình duyệt chặn; chưa cấu hình/ nghiệm thu email thật, chưa tick task.

- [ ] Đăng ký/xác nhận/khôi phục chạy được với email khách được phép; link trả về đúng trang, lỗi rõ và không tiết lộ tài khoản người khác.
- [ ] Secret SMTP chỉ ở server; phiên giữ theo quyết định hiện tại, đăng xuất không còn quyền đọc đơn.
      Phụ thuộc: BU-01, nhà cung cấp email/người gửi. File: PortalShell, Store, backend, config/hướng dẫn Auth. Kiểm: SDK, UI, Build, Ops.

### BU-03 — Nghiệm thu quyền và luồng đơn hiện có — M

- [ ] Hai khách/admin thử COD/VietQR, retry/lỗi mạng, trạng thái/hoàn tiền và chia sẻ/revoke; không truy cập chéo hoặc đặt trùng.
- [ ] Có bằng chứng QR chứa đúng người nhận/tổng/mã; mọi chuyển tiền thật do chủ shop thao tác riêng.
      Phụ thuộc: BU-01–02, thông tin ngân hàng thử. File: tests/tích hợp, fixture và biên bản; lỗi phát hiện tách task sửa riêng. Kiểm: SQL, SDK, UI, Build.

### Checkpoint 0A

- [ ] SMTP/Auth và quyền của luồng hiện tại đã nghiệm thu; danh sách lỗi có mức độ và người xử lý.

### BU-04 — Nghiệm thu giao diện hiện tại — M

- [ ] Storefront/checkout/account/admin chạy trên 320/375/768/1440 px; form, dialog, bàn phím và reduced motion dùng được.
- [ ] Không mất giỏ/draft đang nhập khi request lỗi; nội dung dài không phá layout.
      Phụ thuộc: BU-03, quyền trình duyệt. File: các phần UI có lỗi và biên bản; giới hạn mỗi lần sửa 3–5 file. Kiểm: UI, Build, focused regression.

### BU-05 — Backup và retention — S

Trạng thái: đang làm phần độc lập với SMTP (chỉ phụ thuộc BU-01). Diễn tập backup đĩa → database local mới và retention đã qua; [BACKUP-RESTORE.md](../BACKUP-RESTORE.md) ghi phạm vi. Chưa có backup/restore backend thật và lịch sử Cron, chưa tick task.

- [ ] Có backup ngoài database và khôi phục được vào môi trường thử; không lộ secret/PII trong repo hoặc log.
- [ ] Cron có lịch sử chạy, xóa đúng thông tin giao hàng đủ hạn, giữ lịch sử/lời nhắn và không cho khách gọi job.
      Phụ thuộc: BU-01. File: script vận hành, hướng dẫn backup/retention. Kiểm: SQL, Ops.

### BU-06 — Điều kiện mở bán — S

- [ ] Chủ shop chốt vùng/phí/cutoff/hủy/hoa thay thế, dữ liệu sản phẩm và quyền ảnh/video.
- [ ] Hosting phù hợp mục đích thương mại và ngân sách được chốt; production vẫn đóng đến nghiệm thu bản A.
      Phụ thuộc: BU-03–05, quyết định chủ shop. File: cấu hình/chính sách và checklist launch. Kiểm: Ops, UI các chính sách hiển thị.

### Checkpoint 0B

- [ ] Các việc QA còn mở của bản cũ có kết quả; đủ dữ liệu/điều kiện để xây bản A.

### Bản A — vận hành

### BU-07 — Album ảnh sản phẩm — M

- [ ] Admin upload/sắp xếp ảnh; ảnh đúng loại/dung lượng, file lạ bị chặn và không có quyền upload của khách.
- [ ] Khách xem album và ảnh dự phòng khi ảnh lỗi; ảnh được nén và tải theo nhu cầu.
      Phụ thuộc: BU-06. File: storage/migration, admin ảnh, ProductDialog và test. Kiểm: SQL/storage policy, SDK, UI, Build.

### BU-08 — Admin quản lý biến thể — M

- [ ] Admin tạo/sửa/tắt cỡ bó với mã/giá/trạng thái hợp lệ, có version/audit.
- [ ] Sản phẩm/đơn cũ vẫn đọc được; biến thể tắt không tạo lựa chọn đặt mới.
      Phụ thuộc: BU-07. File: migration, admin biến thể, Store/backend và test. Kiểm: SQL, SDK, UI, Build.

### BU-09 — Khách đặt biến thể và snapshot — M

- [ ] Khách chọn đúng biến thể trong chi tiết/giỏ/checkout; máy chủ tính tiền và phát hiện quote thay đổi.
- [ ] Đơn giữ tên/cỡ/giá và metadata cần cho kỉ niệm; sửa catalog không sửa đơn đã lưu, retry không nhân bản.
      Phụ thuộc: BU-08. File: RPC/migration, lựa chọn sản phẩm, order.js, LiveCheckout/giỏ và test; tách tiếp nếu hơn 5 file chính. Kiểm: SQL, SDK, UI, Build.

### Checkpoint A1

- [ ] Admin nhập được sản phẩm/biến thể thật; khách đặt và xem đúng snapshot, dữ liệu cũ tương thích.

### BU-10 — Cấu hình lịch và năng lực giao — M

- [ ] Admin cấu hình vùng/phí, ngày nghỉ, slot/cutoff và năng lực; dữ liệu sai bị backend từ chối.
- [ ] Khách thấy khung giờ được phép và điều kiện xác nhận; không có slot giả khi shop đóng.
      Phụ thuộc: BU-09. File: migration, admin lịch, checkout lịch và test. Kiểm: SQL, SDK, UI, Build.

### BU-11 — Giữ và nhả chỗ khi xác nhận — M

- [ ] Xác nhận đơn giữ chỗ nguyên tử; thử hai thao tác đồng thời không vượt năng lực.
- [ ] Hủy/đổi lịch nhả/đổi chỗ đúng một lần; retry/stale version không sai số lượng.
      Phụ thuộc: BU-10. File: RPC/migration reservation, admin cập nhật, timeline và test. Kiểm: SQL, SDK concurrency, UI, Build.

### BU-12 — Bàn xử lý đơn theo ca — M

- [ ] Admin có hàng đợi hôm nay/chờ xác nhận/bó/giao/đối soát; tìm và lọc bằng truy vấn có phân trang/index.
- [ ] Ghi chú nội bộ và sự kiện khách thấy được tách rõ; đổi tab/filter không hiển thị kết quả truy vấn cũ.
      Phụ thuộc: BU-11. File: AdminPortal tách màn hình, query/RPC, index và test. Kiểm: SQL, SDK, UI, Build.

### Checkpoint A2

- [ ] Một ca thử có lịch, slot và hàng đợi đúng; xác nhận đồng thời không overbook.

### BU-13 — Yêu cầu thay đổi hoặc hủy — M

- [ ] Khách gửi và theo dõi yêu cầu; backend kiểm tra chủ đơn/thời điểm/trạng thái và admin xử lý có audit.
- [ ] Không ghi đè snapshot/tiền đã nhận hoặc báo đã hủy trước khi yêu cầu thực sự được xử lý.
      Phụ thuộc: BU-12, chính sách đã chốt. File: migration/RPC yêu cầu, OrderDetail, admin yêu cầu và test. Kiểm: SQL, SDK, UI, Build.

### BU-14 — Sổ đối soát COD/VietQR — M

- [ ] Có danh sách cần thu/đã thu/hoàn toàn phần, người/thời điểm/tham chiếu; chỉ vai trò phù hợp được xác nhận.
- [ ] Tổng báo cáo khớp các khoản đã ghi nhận; thông báo của khách không tự chuyển PAID, ghi nhận hoàn không chuyển tiền.
      Phụ thuộc: BU-13. File: migration/RPC, admin đối soát, OrderDetail và test. Kiểm: SQL tiền/quyền, SDK, UI, Build.

### BU-15 — Giao việc và giao lại — M

- [ ] Admin gán người phụ trách; người giao thấy phần thông tin cần giao và cập nhật sự kiện đúng quyền.
- [ ] Giao thất bại/giao lại có timeline; chỉ hoàn tất thật + đã nhận tiền mới sinh một kỉ niệm.
      Phụ thuộc: BU-14. File: migration/RPC, màn hình giao nhận, OrderDetail và test. Kiểm: SQL, SDK, UI, Build.

### Checkpoint A3

- [ ] Yêu cầu thay đổi, đối soát và giao lại cùng chạy trong một ca thử; trạng thái/kỉ niệm không sai.

### BU-16 — Vai trò vận hành và xem audit — M

- [ ] Chủ shop quản lý quyền; khách/nhân viên không tự cấp quyền hoặc xóa quyền chủ shop cuối cùng.
- [ ] Backend giới hạn theo vai trò/field: đối soát không thấy thiệp/địa chỉ ngoài nhu cầu, giao nhận không sửa tiền; audit không sửa được từ client.
      Phụ thuộc: BU-15, ma trận quyền chủ shop chốt. File: permission RPC/RLS, Store, admin quyền/audit và test; chia thành lượt nếu cần. Kiểm: SQL, SDK từng vai trò, UI, Build.

### BU-17 — Thông báo đơn có retry — M

- [ ] Khách có thông báo trong tài khoản và email trạng thái qua backend; không gửi lời nhắn riêng trong email trạng thái mặc định.
- [ ] Worker/outbox retry không gửi trùng và ghi lỗi an toàn; không phụ thuộc browser hay Vercel Functions.
      Phụ thuộc: BU-02, BU-16. File: outbox/migration, worker email, account/thông báo và test. Kiểm: SDK tích hợp email, retry, UI, Build, Ops.

### BU-18 — Dashboard và báo cáo vận hành — M

- [ ] Hiển thị việc đang chờ, đơn giao thành công, tiền đã nhận/hoàn; không gọi giá trị đơn chờ là doanh thu đã thu.
- [ ] Báo cáo/export có quyền, lọc ngày và giới hạn; không công khai dữ liệu giao hàng hoặc tải mọi đơn lên browser.
      Phụ thuộc: BU-17. File: aggregate/query/RPC, dashboard/export và test. Kiểm: SQL tiền/quyền, SDK, UI, Build.

### Cổng bản A

- [ ] Chủ shop vận hành được ca thử từ đặt tới giao/đối soát; các lỗi quan trọng được xử lý.
- [ ] Backup, email, chính sách, dữ liệu, hosting và quan sát lỗi đủ trước khi mở nhận đơn.

### Bản B — kỉ niệm

### BU-19 — Dòng thời gian và đặt lại trong góc cá nhân — M

- [ ] Khách lọc kỉ niệm/lịch sử của mình, xem trạng thái chia sẻ và liên kết đúng đơn/thiệp.
- [ ] Đặt lại dùng giá/tình trạng hiện tại; không phục hồi địa chỉ đã xóa hoặc lấy lịch sử người khác.
      Phụ thuộc: bản A. File: CustomerPortal tách trang, RPC/cursor, Store/giỏ và test. Kiểm: SQL, SDK, UI, Build.

### BU-20 — Thiệp với URL và mẫu thiết kế — M

- [ ] Có /memories/token và giữ hash link cũ; preview đúng chính lời nhắn và chữ ký khách chọn.
- [ ] PRIVATE/LINK/GARDEN và token rotation vẫn đúng; thiệp không cần login khi được chia sẻ.
      Phụ thuộc: BU-19. File: routing adapter, Garden/SharedMemory, MemorySharing, styles và test. Kiểm: SQL, SDK, UI, Build.

### BU-21 — Preview mạng xã hội và ảnh thiệp — M

- [ ] Metadata/ảnh chỉ chứa phần public, noindex mặc định; thiệp riêng/đã revoke không được worker render hay cache tiếp.
- [ ] Khách chọn tải/chia sẻ ảnh và thấy thông báo về bản sao không thu hồi; không public storage ảnh riêng.
      Phụ thuộc: BU-20, hạ tầng render phù hợp. File: worker public, template ảnh, SharedMemory, cache policy và test. Kiểm: SDK revoke/cache, crawler integration, UI, Build.

### Checkpoint B1

- [ ] Thiệp mới/cũ cùng mở đúng, link và ảnh không lộ thông tin ngoài opt-in, revoke chặn truy cập mới.

### BU-22 — Khám phá vườn và metadata lịch sử — M

- [ ] Danh sách lọc tháng/dịp, dùng cursor và trạng thái trống/lỗi; dữ liệu cũ thiếu metadata được đánh dấu chưa rõ.
- [ ] Không suy lại lịch sử từ catalog hiện tại hoặc trả ID/link/vị trí của kỉ niệm riêng.
      Phụ thuộc: BU-21. File: migration/backfill, public RPC/index, Garden và test. Kiểm: SQL legacy/privacy, SDK, UI, Build.

### BU-23 — Vườn 2D và cụm hoa — M

- [ ] Zoom/pan/select lấy aggregate hoặc dấu public theo vùng, số node/request có giới hạn.
- [ ] Danh sách và bàn phím vẫn dùng được; số tổng hợp không tiết lộ bản ghi riêng và truy vấn vùng có index.
      Phụ thuộc: BU-22. File: aggregate/RPC, component vườn 2D, accessibility/styles và test; nếu quá M tách API/vườn nối tiếp. Kiểm: SQL, SDK, UI, Perf, Build.

### BU-24 — Revoke và báo cáo nội dung toàn luồng — M

- [ ] Revoke/hoàn tiền cập nhật link, list, cụm và tài nguyên shop phục vụ; lượt truy cập mới không xem được nội dung cũ.
- [ ] Báo cáo/xử lý lạm dụng có quyền và audit sau công khai; vẫn không duyệt trước hay xóa lịch sử riêng.
      Phụ thuộc: BU-23, quy tắc xử lý đã chốt. File: migration/RPC, report UI, admin xử lý, worker cache và test. Kiểm: SQL, SDK race/cache, UI, Build.

### Checkpoint B2

- [ ] Khám phá/zoom/list/revoke cùng đúng; không lộ dữ liệu riêng dưới các vai trò và tình huống lỗi.

### BU-25 — Benchmark đầy đủ và phục hồi kỉ niệm — M

- [ ] Đo cả đơn/kỉ niệm/lịch sử, thông điệp dài và truy cập đồng thời ở môi trường Postgres thử đủ dung lượng; ghi rõ quota/chi phí.
- [ ] Kiểm tra uniqueness, aggregate, dữ liệu cũ và khôi phục; không nạp dataset lớn vào production hay coi benchmark local là SLA.
      Phụ thuộc: BU-24, môi trường thử đủ tài nguyên. File: benchmark script, fixture, test/audit, báo cáo. Kiểm: SQL, Perf, SDK concurrency, Ops.

### Cổng bản B

- [ ] Khách có góc riêng/thiệp và vườn công khai dùng được; quyền rút chia sẻ đúng từ API tới tài nguyên.
- [ ] Có báo cáo dung lượng/index/query và lộ trình nâng hạ tầng trước khi đạt quota.

### Bản C — trải nghiệm

### BU-26 — Giao diện dùng chung và mobile — M

- [ ] Các phần storefront/account/admin dùng cùng quy tắc font/màu/nút/form; tách component khi sửa, mỗi lượt tối đa khoảng 5 file.
- [ ] Không overflow, focus nhìn thấy được, contrast và reduced motion dùng được.
      Phụ thuộc: bản B. File: shared UI/styles, App, PortalShell, màn hình đang nâng cấp. Kiểm: UI, Build.

### BU-27 — Trang sản phẩm và bộ sưu tập — M

- [ ] Có URL thật cho sản phẩm/bộ sưu tập, album/biến thể và thông tin giao/chăm sóc; giữ tương thích link cũ.
- [ ] Tìm/lọc/sắp xếp và sản phẩm đã tắt có trạng thái đúng; không đổi giá/đơn cũ.
      Phụ thuộc: BU-26. File: route/page sản phẩm, collection, ProductDialog dùng chung và test. Kiểm: SDK, UI, URL integration, Build.

### BU-28 — Giỏ/checkout trên mobile — M

- [ ] Khách thấy phí, khu vực, lịch, phương thức và điều kiện xác nhận trước nút gửi; dữ liệu lỗi được chỉ rõ.
- [ ] Lỗi mạng/quote thay đổi không mất giỏ hoặc báo giả thành công; luồng tiền/slot vẫn do máy chủ kiểm tra.
      Phụ thuộc: BU-27. File: ShopDialogs/LiveCheckout, shared field/summary và test. Kiểm: SQL, SDK, UI, Build.

### Checkpoint C1

- [ ] Luồng chọn → xem sản phẩm → giỏ → đặt vẫn chạy đúng trên mobile và desktop sau đổi route/UI.

### BU-29 — Admin sửa nội dung hero/câu chuyện — M

- [ ] Chủ shop chỉnh các khối hero/story/collection nổi bật, có preview và xuất bản với version/audit.
- [ ] Nội dung sai bị chặn, không cho chèn script/HTML tùy ý; lỗi config có bản dự phòng đọc được.
      Phụ thuộc: BU-28. File: migration/content model, admin nội dung, App/sections và test. Kiểm: SQL, SDK, UI, Build.

### BU-30 — FAQ, chính sách và cách chăm hoa — M

- [ ] Chủ shop chỉnh được các khối cố định; khách đọc được nội dung theo sản phẩm/ngữ cảnh cần thiết.
- [ ] Nội dung public không chứa dữ liệu đơn/tài khoản, xuất bản không làm sai điều khoản áp dụng cho đơn cũ.
      Phụ thuộc: BU-29. File: content migration/validation, admin, public sections/pages và test. Kiểm: SQL, SDK, UI, Build.

### BU-31 — SEO sản phẩm và metadata — M

- [ ] URL public sản phẩm có HTML metadata, canonical/sitemap/structured data đúng giá/tình trạng được phép công khai.
- [ ] Account/admin/đơn/thiệp mặc định noindex; renderer không dùng quyền cao để lấy dữ liệu riêng.
      Phụ thuộc: BU-30; tái dùng route/renderer BU-20–21. File: public rendering/prerender, sitemap/metadata, deployment config và test. Kiểm: crawler integration, SDK privacy, Build, UI.

### BU-32 — Hiệu năng, đo hành trình và nghiệm thu cuối — M

- [ ] Tách tải theo trang, tối ưu ảnh/video/font và đo trên thiết bị/mạng ghi rõ; hướng tới LCP≤2,5s, CLS≤0,1, INP≤200ms khi đủ field data.
- [ ] Funnel không gửi thông điệp/PII/token ra analytics; các luồng A/B vẫn đúng sau tối ưu và có rollback.
      Phụ thuộc: BU-31. File: build/loading config, asset pipeline, analytics events, perf report và test. Kiểm: Perf, SDK, UI, Build, Ops.

### Cổng bản C

- [ ] Storefront/content/SEO/mobile được nghiệm thu; URL và dữ liệu cũ tương thích.
- [ ] Không còn lỗi nghiêm trọng về quyền/tiền/đơn/kỉ niệm; tài liệu, release note và hạn chế đã ghi rõ.
