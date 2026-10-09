# BU-08/09 — Cỡ bó hoa và đơn hàng

Mã nguồn đã kiểm chứng local, chưa nghiệm thu backend/UI thật. Phát hành vẫn chờ BU-06–07 và QA của bản A; production đóng nhận đơn.

## Quản lý và lựa chọn

Giá trên sản phẩm là cỡ Tiêu chuẩn, giữ cách đặt cũ. Admin thêm các cỡ bổ sung với SKU duy nhất (2–40 ký tự chữ/số/_/-), tên, giá VNĐ nguyên từ 1.000 tới 100.000.000 và trạng thái. SKU nhập thường được đổi sang chữ hoa. Chỉ admin tạo/sửa, mỗi lần sửa có version và audit; cỡ không chuyển sang sản phẩm khác hoặc bị xóa từ client.

Khách chọn cỡ trong chi tiết bó hoa. Nút thêm nhanh mở lựa chọn khi có cỡ bổ sung. Giỏ phân biệt theo sản phẩm+cỡ; sửa/xóa một cỡ không tác động cỡ khác. Giỏ cũ thiếu variantId vẫn là Tiêu chuẩn. Cỡ không còn bán được bỏ khỏi giỏ, không tự đổi sang Tiêu chuẩn. Các cỡ đang bán được tải cùng catalog bằng một truy vấn riêng, không gọi từng sản phẩm.

Chi tiết, giỏ, checkout và lịch sử dùng cùng tên/cỡ/giá. Thông tin giỏ lưu ở trình duyệt vẫn chỉ là ID/cỡ/số lượng; không lưu địa chỉ, thiệp hay thông tin đăng nhập.

## Máy chủ và snapshot

RPC `gd_create_order` nhận `items:[{id,variantId?,quantity}]`. Không có variantId hoặc null là Tiêu chuẩn. Cỡ phải đang bật và thuộc sản phẩm đang bật. Cùng sản phẩm khác cỡ được đặt cùng đơn, cùng cỡ lặp bị từ chối; số lượng mỗi dòng 1–20 và tối đa 20 dòng.

Máy chủ tự lấy giá, khóa đọc sản phẩm/cỡ trong giao dịch, tính lại tổng và đối chiếu expectedTotal; không dùng giá/SKU/tên cỡ do client gửi. Đơn giữ snapshot tên/ảnh/dịp/giá/cỡ/SKU. Retry cùng requestId và payload trả đúng đơn cũ ngay cả khi giá/tên/trạng thái cỡ đã đổi; payload khác vẫn bị từ chối.

Kỉ niệm mới giữ metadata sản phẩm/dịp/cỡ từ **snapshot đơn**, không suy lại từ catalog hiện tại. Metadata bất biến và chưa được thêm vào public RPC. Kỉ niệm cũ có metadata `{}`; không backfill bằng catalog mới. Chia sẻ vẫn chỉ công khai chính thông điệp khách đồng ý chia sẻ theo cơ chế hiện có.

## Triển khai

- **007** thêm bảng/quyền/version/audit cỡ và `features.productVariants`: bật quản lý admin.
- **008** thay RPC tính tiền/snapshot, thêm metadata kỉ niệm và `features.variantOrders`: bật lựa chọn khách.
- Frontend trên backend 005/006 không truy vấn bảng chưa tồn tại. Backend chỉ có 007 cho admin chuẩn bị cỡ nhưng chưa đưa cỡ bổ sung vào storefront.
- Staging đã cài 001–005: áp dụng lần lượt migrations 006, 007, 008 khi dashboard cho phép; không chạy lại bootstrap. Production cần 005 trước các migrations này và các cổng nghiệm thu trước khi merge/mở bán. Trong bước này agent chưa áp dụng hosted migrations.

## Kiểm chứng

36 Node/PostgreSQL tests qua: SKU/giá/quyền/parent/version/audit, cỡ tắt/sản phẩm tắt, giỏ nhiều cỡ, giá client giả, quote đổi, retry, snapshot sau khi sửa catalog, metadata kỉ niệm và luồng cũ. Mutation gộp mọi cỡ thành một key làm test giỏ thất bại; đã khôi phục và chạy lại xanh.

SDK Supabase qua transport PostgreSQL local kiểm tra tạo/tắt cỡ, khách chỉ đọc cỡ bật, đơn nhiều cỡ tính giá máy chủ và retry giữ snapshot; các luồng album/đơn/đối soát/chia sẻ/revoke/audit vẫn qua. Build staging qua, còn cảnh báo chunk lớn đã có từ trước. Không thêm dependency.

Chưa kiểm tra giao diện thật/mobile/keyboard, phiên admin/khách qua hosted Auth, hoặc rollout migrations thật. Không coi local tests hoặc preview READY là nghiệm thu BU-08/09.

Đã sửa pattern SKU cho cú pháp regex của HTML hiện tại theo [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern); validation quyết định vẫn ở database.
