# Garden Dreams — triển khai phạm vi đã được xác nhận

Ngày 09/10/2026: chủ shop xác nhận sơ đồ module, COD/VietQR đối soát thủ công, lịch sử mua và chia sẻ chính thông điệp trên thiệp. Mặc định riêng tư; link chia sẻ và đưa vào vườn là hai lựa chọn. Không cần duyệt trước.

Thực hiện lần lượt: database và kiểm thử quyền → tài khoản/storefront → đặt đơn và thanh toán → lịch sử/chia sẻ → quản trị → kiểm thử trình duyệt → push/deploy.

Supabase PostgreSQL giữ nghiệp vụ trong migrations/RPC để giá tiền, quyền, trạng thái và tạo kỉ niệm được kiểm tra phía máy chủ. RLS bảo vệ bảng; mọi RPC security definer đặt search_path rỗng và kiểm tra quyền. Không đưa service-role key vào frontend. Phiên Auth giữ trong bộ nhớ, không localStorage. Mỗi đơn lưu snapshot giá/ship/bank để thay đổi cấu hình không thay đổi đơn cũ.

Vườn dùng cursor và tải tối đa 24 dấu mỗi lần; mỗi đơn chỉ tạo một kỉ niệm. Retry cùng request ID khác dữ liệu phải bị từ chối. COD/VietQR chỉ admin được xác nhận đã thu tiền.

Kiểm chứng SQL bằng PostgreSQL nhúng PGlite với vai trò anon/authenticated, hai khách và admin. Kiểm thử truy cập chéo, sửa giá, sửa trạng thái, quyền thanh toán, chia sẻ/rút chia sẻ, concurrency và một triệu kỉ niệm giả. Kiểm thử frontend trong trình duyệt. Dữ liệu thật trên Supabase chỉ cấu hình khi quyền truy cập tài khoản được mở.

Các files/spec giữ theo module id trong CAPABILITY-MAP. Không nâng gói trả phí hoặc tự gửi giao dịch/tin nhắn. API Blob cũ được gỡ khỏi luồng mới; frontend chưa nối backend vẫn hiển thị demo rõ ràng.

## Đề xuất big update — 09/10/2026

Chủ shop đã yêu cầu triển khai lần lượt và cập nhật sau mỗi task ngày 09/10/2026. Trạng thái/bằng chứng nằm trong [progress.md](progress.md); giữ các cổng nghiệm thu, không tick dựa vào code/build đơn thuần.

Chủ shop chọn thứ tự: vận hành/bán hoa thật → vườn kỉ niệm → hoàn thiện trải nghiệm toàn website. Kế hoạch đã được cho phép triển khai: [BIG-UPDATE-PLAN.md](../BIG-UPDATE-PLAN.md).

Backlog `BU-01` tới `BU-32` được bổ sung trong todo.md. Các việc chưa nghiệm thu của bản hiện tại vẫn còn nguyên và là đầu vào giai đoạn 0. Từng task là một lát cắt có dữ liệu/API/UI và kiểm chứng; chưa đổi stack, hosting hoặc gói trả phí khi lập kế hoạch.

Mốc phát hành: nền tảng/QA → A vận hành → B thiệp/khu vườn → C storefront/content/SEO/mobile. Giữ các quyết định về COD/VietQR thủ công, opt-in và một kỉ niệm/đơn đã giao/paid. Migration mới nối tiếp lịch sử hiện tại, không chạy lại setup.sql.

Khi dashboard/SMTP chưa thao tác được, tiếp tục chuẩn bị mã nguồn BU-07–09 trên branch staging. BU-06 và các task phụ thuộc vẫn là điều kiện nghiệm thu/phát hành; không tick chỉ dựa vào SQL local hoặc build. Backend báo khả năng album/upload/quản lý cỡ/đặt cỡ để frontend mới tương thích với backend đang chạy. Production tiếp tục đóng nhận đơn.

---

# Remaining issues — 19 October 2026

Scope: all 29 currently open issues (#10, #17–29, #31–45). Keep the transparent initial navigation and falling petals. No fabricated product specifications, customer records, payments or Google indexing claims.

1. Payment/SEO/catalog correctness: #17–20, #22. Reuse server balances, canonical availability and owner-scoped storage. Test partial payments, robots lifecycle, variant prices, fallback copy and account changes.
2. Storefront navigation and discovery: #26–29, #31–34, #40, #45. Compact consistent navigation, visible controls and filter chips, URL history, honest result counts, mobile detail layout and unavailable-product next steps. Preserve private favorite IDs outside shared URLs.
3. Cart/checkout/account: #21, #35–39. Reopen details, reversible cart removal, summary at auth gates, accurate guest guidance, normalized phones and linked field errors, password requirements.
4. Garden: #41–44. Search all original greeting suggestions, retain pagination/focus across navigation, copy messages and safely share public card URLs without session/query data.
5. Admin/specifications/performance: #23–25. Dirty-form protection, editable public size descriptions with normal seasonal bouquet copy, deferred checkout/QR and a measured entry budget. Owner waived confirmed measurements; do not invent exact stem counts or dimensions.
6. Verification/release: full tests and build, browser checks at 320/390/1440 px, hosted HTTP/metadata and lab mobile metrics for #10. Merge/deploy with immutable evidence. Google Search Console/field CWV cannot be claimed without access/data.

Close only issues whose acceptance criteria have evidence. Owner chose technical SEO only for #10 on 19 October; Search Console/Google indexing is excluded. Lab measurements do not establish field CWV.
