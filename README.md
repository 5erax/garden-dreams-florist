# Garden Dreams

Web bán hoa React + Vite, tiếng Việt, video nền, hoa rơi, parallax và chuyển động khi cuộn. Backend độc lập với Vercel bằng Supabase PostgreSQL + Auth + RLS/RPC. Đơn hàng và thanh toán không dùng Vercel Blob/Functions.

- Repo private: [5erax/garden-dreams-florist](https://github.com/5erax/garden-dreams-florist).
- Website: [garden-dreams-florist.vercel.app](https://garden-dreams-florist.vercel.app/). Push `main` tự deploy qua GitHub.
- **Cài backend:** [SUPABASE-SETUP.md](SUPABASE-SETUP.md). SQL chạy một lần trên project mới: [supabase/setup.sql](supabase/setup.sql).
- **Big update:** [kế hoạch](BIG-UPDATE-PLAN.md), [checklist](tasks/todo.md) và [tiến độ sau từng task](tasks/progress.md). BU-01 tách staging đã hoàn thành; chuẩn bị email Auth ở BU-02.

## Chạy local

Node.js 24: `npm ci`, rồi `npm run dev`. Kiểm tra bằng `npm test`, `npm run build`, `npm audit`.

Không có cấu hình Supabase thì website ở chế độ xem thử, không lưu đơn hoặc báo giả đã nhận đơn. Cấu hình production/staging/local được kiểm tra trước build và trước thao tác dữ liệu; xem [STAGING.md](STAGING.md). Project dùng frontend mới phải có migration 005; database production hiện tại chưa áp dụng migration này. Cửa hàng vẫn đóng nhận đơn cho đến khi admin cấu hình và nghiệm thu.

## Chức năng đã viết

- 20 bó hoa mẫu, giá VNĐ, tìm kiếm/lọc/sắp xếp, chi tiết, yêu thích và giỏ hàng; admin thêm/sửa/ẩn hoa, chỉnh thông tin cửa hàng.
- Tài khoản email, đăng ký/đăng nhập/khôi phục; lịch sử riêng, tiến trình đơn và lời nhắn trên thiệp. Khách không tự nâng quyền admin.
- Admin quản lý khu vực/dịch vụ/phí giao, COD và thông tin ngân hàng VietQR; sửa trạng thái đơn, ghi nhận thu/hoàn tiền với ghi chú đối soát và nhật ký.
- Máy chủ tính lại giá/phí, kiểm tra ngày/số lượng/consent, chặn retry khác dữ liệu và giới hạn tần suất đặt. Đơn giữ snapshot hoa, giá, phí ship và tài khoản nhận tiền.
- Mỗi đơn đã giao + đã trả tạo đúng một kỉ niệm, mặc định riêng tư. Khách chọn chia sẻ chính lời nhắn qua link hoặc cả Vườn kỉ niệm, không cần admin duyệt. Người khác xem link không cần đăng nhập; rút chia sẻ làm link cũ mất hiệu lực.
- Thiệp công khai chỉ gồm thông điệp, chữ ký tự chọn, hình/tên hoa và tháng/năm. Không có tài khoản, số điện thoại, địa chỉ người nhận, giá hay trạng thái đơn. Khách cần tránh tự đưa thông tin cá nhân vào thông điệp chia sẻ.
- Vườn và lịch sử dùng cursor; không tải một triệu kỉ niệm lên trình duyệt cùng lúc. Không tạo dữ liệu đơn/kỉ niệm giả trên website.
- QR sinh local; admin đối soát tiền thủ công, ghi nhận hoàn tiền không tự chuyển tiền. Chưa tự gọi hãng vận chuyển.

## Kiểm chứng

Tests dùng PostgreSQL nhúng PGlite chạy SQL thật với anon, hai khách và admin: RLS/truy cập chéo, giá/phí, idempotency, trạng thái/version, quyền ghi nhận tiền, chia sẻ/rút chia sẻ, xóa thông tin giao hàng, audit, rate limit; kiểm tra payload/CRC VietQR và cursor giữ microsecond. Không thay thế kiểm thử Supabase Auth/email hay ứng dụng ngân hàng thật.

Tích hợp Supabase JS SDK đã kiểm tra với SQL/RLS/RPC thật và transport giả chỉ chạy local. Chạy `node scripts/e2e-server.mjs`, rồi ở terminal khác chạy `node scripts/check-flow.mjs`. Test server chỉ bind `127.0.0.1`; tài khoản/key/password trong script là dữ liệu giả, không dùng trên production. Không triển khai test server thành backend.

Chạy benchmark bằng `node scripts/benchmark-memories.mjs`. [Kết quả một triệu kỉ niệm giả](benchmarks/memories.json): trang 24 dấu dùng index/cursor, không trùng dấu; link trả đúng thông điệp. Table + index khoảng 497 MB với thông điệp ngắn, chưa gồm đơn hàng. Đây là số đo PGlite local, không phải SLA Supabase hay cam kết Free chứa đủ một triệu đơn. Cần đo dung lượng, backup và tải trên hosting thật khi mở rộng.

## Trạng thái và giới hạn

Đã nối project Supabase thật `ztzpipgptticvliotbsc` và redeploy Vercel production ngày 09/10/2026. Chủ project tự chạy SQL setup; kiểm tra API thật xác nhận 20 sản phẩm, vườn trống và các bảng riêng/RPC đặt đơn từ chối anon. Chủ shop xác nhận đã tạo/xác nhận tài khoản, chạy SQL cấp admin và cài Cron retention với active=true; chưa kiểm chứng phiên admin hoặc lịch sử chạy Cron qua công cụ. UI mới chưa kiểm thử bằng trình duyệt do quyền truy cập bị từ chối. Cần kiểm tra luồng đơn thật bằng dữ liệu thử, SMTP cho khách, QR bằng app ngân hàng và lịch sử chạy Cron xóa thông tin giao hàng sau 90 ngày. Phiên đăng nhập giữ trong bộ nhớ tab; tải lại cần đăng nhập lại. Thiệp chưa có preview mạng xã hội riêng.

Website hiện vẫn là bản trải nghiệm. Vercel Hobby dành cho mục đích phi thương mại; chọn hosting phù hợp trước khi bán. Không bật gói trả phí hoặc gửi tiền/tin nhắn tự động. Phone/Zalo `0832345780` do chủ shop cung cấp.

## Nguồn tài nguyên

- [Flowers Are My Friend](https://21st.dev/@rockgaming755/templates/flowers-are-my-friend).
- [Demo tác giả](https://floweraremyfriend.netlify.app/).
- Ảnh story từ Unsplash; video nền và ảnh hoa lấy từ demo công khai theo yêu cầu chủ shop.

Mã ứng dụng viết mới; không có mã React gốc của template. Chưa có giấy phép thương mại ảnh/video tác giả; cần xác minh quyền sử dụng trước khi vận hành bán hoa.
