# Garden Dreams — sơ đồ hệ thống để duyệt

Ngày: 09/10/2026. Trạng thái: đề xuất ranh giới module, chưa triển khai backend mới.

| Module id | Trách nhiệm | Phụ thuộc |
|---|---|---|
| identity | Đăng nhập khách, phiên đăng nhập, quyền chủ shop/admin; khách chỉ xem đơn của mình | — |
| shop-store | Thông tin cửa hàng, catalog, giá, cấu hình COD/tài khoản nhận VietQR; admin chỉnh sửa | identity |
| fulfillment | Dịch vụ giao hoa, vùng giao, phí, khung giờ; lưu cấu hình được dùng tại lúc đặt đơn | identity, shop-store |
| orders | Đặt đơn, giá máy chủ, lịch sử trạng thái, lịch sử mua và theo dõi; retry không tạo đơn trùng | identity, shop-store, fulfillment |
| payments | COD, VietQR đúng tổng tiền/mã đơn; admin xác nhận tiền đã nhận và ghi lịch sử thay đổi | identity, shop-store, orders |
| memories | Một dấu ấn cho mỗi đơn hoàn tất và đã thanh toán; khách tự nguyện công khai lời nhắn, không chờ duyệt | identity, orders, payments |
| portals | Giao diện quản trị, tài khoản khách/theo dõi đơn, vườn kỉ niệm trong thiết kế Garden Dreams | identity, shop-store, fulfillment, orders, payments, memories |

Thứ tự xây: identity → shop-store → fulfillment → orders → payments → memories → portals. Giao diện được nối vào từng module khi module đó có dữ liệu thật.

## Các lựa chọn đã chốt với chủ cửa hàng

- Ưu tiên miễn phí trong giai đoạn xây dựng, chưa mở bán thật.
- COD và chuyển khoản VietQR. Chỉ admin được đánh dấu đã thu tiền sau khi kiểm tra ngân hàng/tiền COD. Quét QR, bấm “đã chuyển” hoặc ảnh chụp không phải bằng chứng tự động thanh toán thành công.
- Khách tự chọn chia sẻ **đoạn thông điệp công khai**. Không có bước admin duyệt trước.
- Lời nhắn riêng trên thiệp và thông điệp công khai là hai trường riêng. Không tự sao chép lời nhắn riêng lên vườn kỉ niệm.
- Công khai ngay khi đơn đã giao hoàn tất, thanh toán được xác nhận và khách đã đồng ý. Khách có thể rút chia sẻ; bản kỉ niệm riêng vẫn tồn tại.
- Đơn thử, hủy hoặc chưa trả tiền không được tính vào số đơn mua thật. Hoàn tiền có lịch sử riêng và cập nhật dấu ấn tương ứng; không xóa dấu vết đối soát.
- Public API chỉ trả nội dung được phép chia sẻ; không trả mã đơn nội bộ, tên, email, điện thoại hay địa chỉ. Một thông điệp khách tự viết vẫn có thể chứa thông tin cá nhân, nên form sẽ nhắc khách kiểm tra trước khi công khai.

## Phương án hạ tầng ưu tiên

**Đề xuất Supabase Free cho backend:** PostgreSQL + Auth + Row Level Security; nghiệp vụ do mã ứng dụng/migrations của shop định nghĩa. Frontend gọi backend này trực tiếp. Dữ liệu và thanh toán không đi qua Vercel Functions/Blob. SQL giữ trong repo để có thể chuyển PostgreSQL sang máy chủ riêng sau này; Auth là phụ thuộc cần xử lý khi chuyển nhà cung cấp.

Vercel tiếp tục phục vụ bản trải nghiệm hiện có. Kết nối repo đã được chấp thuận và thực hiện. Khi mở bán, có thể dùng Cloudflare Workers Static Assets cho frontend miễn phí; việc chuyển frontend là lựa chọn triển khai riêng, chưa thực hiện.

| Lựa chọn | Phần miễn phí hiện tại | Đánh đổi |
|---|---|---|
| Supabase Free — đề xuất | PostgreSQL 500 MB/project, 50.000 MAU, 1 GB file storage, 5 GB egress | Có Auth/RLS sẵn; project có thể bị pause sau 7 ngày ít hoạt động; phải tự xuất backup trong giai đoạn free |
| Cloudflare Workers + D1 | Workers 100.000 request/ngày; D1 tổng 5 GB, 5 triệu dòng đọc và 100.000 dòng ghi/ngày | Phải tự làm thêm lớp tài khoản; mỗi database Free giới hạn riêng, cần tính dung lượng từng DB; dùng SQLite thay PostgreSQL |
| PostgreSQL tự host | Phần mềm miễn phí | VPS, backup, email, domain và vận hành không được mặc định là miễn phí |

Nguồn đã kiểm tra ngày 09/10/2026:

- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/pricing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/

## Vườn kỉ niệm

Hướng thiết kế: một khu vườn tích lũy, mỗi đơn mua thật để lại một dấu hoa riêng; chọn dấu hoa được công khai để đọc lời nhắn. Đơn không chia sẻ lời nhắn vẫn có kỉ niệm riêng, không tiết lộ nội dung lên trang công khai.

Một triệu đơn cần một triệu bản ghi bền vững, mỗi đơn chỉ sinh một kỉ niệm kể cả retry. Giao diện phân trang theo mốc, tải theo vùng/thời gian, hiển thị cụm hoa ở mức thu nhỏ và từng dấu hoa khi xem gần. Không tải toàn bộ dữ liệu hoặc dựng một triệu node DOM.

Mốc một triệu bản ghi là mục tiêu kiểm thử dung lượng/truy vấn với dữ liệu giả khi triển khai. Chưa benchmark và không cam kết một triệu đơn vẫn nằm trong gói miễn phí. Dữ liệu đơn, dòng hàng, lịch sử, thanh toán và index đều chiếm dung lượng ngoài lời nhắn.

## Cần thiết khi triển khai

- Tài khoản/project Supabase của chủ cửa hàng. Không cần gửi service-role key hay mật khẩu trong chat; sẽ cấu hình trực tiếp đúng môi trường.
- Tài khoản admin đầu tiên được gán từ công cụ quản trị đáng tin cậy; đăng ký khách không thể tự nâng quyền admin.
- Tên ngân hàng/BIN, số tài khoản và chủ tài khoản để admin điền khi thử VietQR; danh sách vùng giao và phí ship do admin quản lý.
- Dữ liệu cá nhân và lời nhắn riêng có chính sách giữ/xóa/ẩn danh; kỉ niệm lâu dài giữ phần được khách đồng ý, không buộc giữ thông tin giao hàng mãi mãi.

Chưa tạo tài khoản dịch vụ, chưa nâng gói trả phí, chưa nối Blob và chưa đổi website hiện có sang nhận đơn thật.
