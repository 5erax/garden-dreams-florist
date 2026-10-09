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

## Đợt mở rộng kỹ thuật, giao diện và chức năng — yêu cầu 15.000 LOC

### Nguồn nghiệp vụ cập nhật

Chủ shop yêu cầu tạm dừng phần đang làm để nhận và áp dụng `Flower_Commerce_Functions_Business_Rules_v1.docx`. Đã lưu nguyên bản/nội dung trích trong docs/product; [hợp đồng triển khai](../docs/product/IMPLEMENTATION-CONTRACT.md) và [đối chiếu 95 chức năng](../docs/product/TRACEABILITY.md) điều chỉnh các lát cắt tiếp theo. Ưu tiên P0 correctness/chuỗi end-to-end, sau đó P1/P2 theo nguồn; không thay các quyết định COD/VietQR/kỉ niệm đã chốt, không tự điền ngưỡng DEC còn mở. Backlog BU/FC và mục tiêu thêm 15.000 LOC vẫn giữ, chưa đủ số và chưa nghiệm thu P0.

Chủ shop yêu cầu mở rộng quy mô đợt cải tiến tiếp theo. Baseline trước đợt này trên branch staging `bb848bc`: **10.787 dòng không rỗng** trong src, api, scripts, tests và migrations. Chủ shop xác nhận thêm 15.000 dòng mới trong đợt này; mục tiêu tổng là 25.787 dòng không rỗng. Không bỏ yêu cầu LOC, không tự gọi đủ số dòng khi chưa đạt; không tăng số bằng thư viện, SQL bundle trùng, tài liệu hoặc định dạng lại. `npm run loc` ghi physical/nonblank và nhóm file để báo tiến độ. Chú thích được tính và công khai trong cách đo, không dùng chú thích dài để tăng lượng.

Mở rộng kế hoạch BU/FC đã có, không tạo backlog cạnh tranh hoặc đóng các task còn dở. Thứ tự mã nguồn: BU-10 lịch giao → BU-11 giữ chỗ → BU-12 bàn xử lý đơn → BU-13 thay đổi/hủy → BU-14 đối soát → BU-15–18 vận hành/quyền/báo cáo; sau đó các module inventory/recipe và BU-19–32 theo phụ thuộc. Công việc không phụ thuộc SMTP có thể phát triển và kiểm thử local trên staging trong lúc chờ cấu hình hosted; điều kiện phát hành/mở bán vẫn giữ nguyên.

### Lát cắt mở đầu: lịch giao từ server

- Admin cấu hình lịch theo dịch vụ: ngày trong tuần, ca, sức chứa, lead time và ngày nghỉ, với version/audit. Mặc định không tự áp chính sách mới vào vùng giao thật.
- Khách chọn ngày/ca có trạng thái khả dụng từ backend, tổng/địa chỉ/draft giữ nguyên khi lịch lỗi. Khả năng mới chỉ hiện khi backend có migration; backend cũ giữ luồng hiện tại.
- Server chặn lịch đóng/hết cutoff/hết năng lực lúc tạo yêu cầu; khi xác nhận phải giữ chỗ trong cùng transaction. Đơn cũ không bị chỉnh lịch, snapshot hoặc dữ liệu cá nhân.
- Kiểm: PostgreSQL/RLS, timezone/cutoff, retry, capacity và xác nhận/hủy; JSX rendering và build. Hosted UI/SDK acceptance tách khỏi local.

Giao diện tiếp tục thương hiệu kem/hồng với font/ảnh hiện có; mật độ và cỡ chữ ưu tiên đặt nhanh. Admin được chia màn hình theo công việc, query có giới hạn và backend quyền; không đổi stack hoặc cài thư viện UI mới chỉ để tăng số dòng. Mỗi lát cắt xong cập nhật progress.md với LOC, kiểm chứng và việc còn chờ.
