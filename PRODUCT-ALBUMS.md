# BU-07 — Album ảnh sản phẩm

Mã nguồn được chuẩn bị trên branch staging; chưa nghiệm thu Storage hoặc giao diện thật. BU-06 vẫn là điều kiện phát hành. Không mở nhận đơn.

## Hành vi

- Admin thêm tối đa 8 ảnh, đổi thứ tự bằng nút và bỏ ảnh khỏi album. Ảnh đầu là bìa; lưu album cùng các trường sản phẩm theo version/audit hiện có. Upload thành công chưa cập nhật sản phẩm cho đến khi bấm Lưu.
- Album trống giữ trường ảnh bìa cũ. Sản phẩm có URL ảnh cũ bên ngoài vẫn sửa được khi album trống; URL mới trong album chỉ nhận tài nguyên `/flowers/` hoặc bucket ảnh của chính project.
- Khách xem ảnh lớn và chọn ảnh nhỏ bằng bàn phím/nút. Ảnh nhỏ tải lazy, ảnh lỗi hiện placeholder trung tính. Lịch sử đơn/kỉ niệm giữ ảnh bìa snapshot tại thời điểm đặt.
- JPEG/PNG/WebP nguồn tối đa 20 MB; kiểm tra signature, decoder và kích thước tối đa 32 megapixel. Canvas thu nhỏ cạnh dài tối đa 1600 px và xuất WebP tối đa 2 MB. Đây là xử lý trong trình duyệt; decoder thật còn cần kiểm tra trên thiết bị.
- Upload tuần tự, khóa sửa/lưu/chuyển mục trong lúc xử lý. Nếu một ảnh lỗi, các ảnh đã upload vẫn nằm trong bản nháp để admin lưu hoặc xử lý tiếp.

## Database và Storage

Migration **006** nối tiếp **005**. Staging hiện đã có 001–005: chỉ áp dụng `supabase/migrations/202610090006_product_albums.sql` khi dashboard cho phép. Không chạy lại `staging-setup.sql`; file đó chỉ dành cho project staging hoàn toàn mới. Production chưa có 005 và chưa được cập nhật trong bước này.

Bucket `gd-product-images` là **public, chỉ chứa ảnh sản phẩm**; không dùng cho đơn, thông tin giao hàng hay thiệp riêng tư. Cấu hình bucket chỉ nhận MIME `image/webp`, tối đa 2 MB. Migration từ chối bucket trùng tên khác cấu hình và rollback thay vì tự đổi bucket riêng tư thành public.

RLS cho admin INSERT đường dẫn `products/<admin-user-id>/<uuid>.webp` và SELECT; không cấp UPDATE/DELETE cho ứng dụng. Upload dùng UUID mới và `upsert:false`, giữ các ảnh được đơn cũ tham chiếu. Kiểm tra bucket thật và các policy khác trên `storage.objects` trước nghiệm thu, vì policy permissive khác có thể mở rộng quyền.

`gd_environment()` báo `features.productAlbum` và `features.productImageUpload`. Frontend mới ẩn chức năng admin album với backend 005; vẫn hiển thị ảnh bìa và lưu các trường cũ. Fixture không có Storage báo upload=false. Không có token quản trị/Storage secret trong frontend.

## Kiểm chứng và việc còn mở

- Tests PostgreSQL nhúng: giới hạn/URL/trùng ảnh, admin và khách, album→bìa, snapshot đơn cũ; mô hình Storage RLS, path/bucket/owner, cấm ghi đè/xóa, rollback bucket xung đột.
- Tests ảnh thuần và Canvas stub: MIME/signature/dung lượng, tỷ lệ, lỗi encode, retry nén, giải phóng bitmap. Stub không chứng minh chất lượng ảnh hoặc khả năng decoder thật.
- SDK Supabase local: ghi/đọc album, version cũ bị từ chối, khách không sửa được, đơn giữ ảnh cũ; luồng đặt/đối soát/chia sẻ/revoke vẫn qua. Transport local không mô phỏng Storage file API.
- Build staging qua. Chưa kiểm tra upload/download MIME/size qua Storage thật, thay đổi sản phẩm bằng phiên admin thật, ảnh hỏng/mobile/keyboard trong trình duyệt. Dashboard Supabase vẫn bị công cụ từ chối dù chủ shop đã sửa quyền và khởi động lại.
- Ảnh upload nhưng chưa lưu sản phẩm được giữ lại; chưa có cleanup orphan tự động. Cần theo dõi dung lượng bucket và bổ sung cleanup khi có index tham chiếu ảnh từ sản phẩm/đơn/kỉ niệm. Không xóa ảnh chỉ vì bỏ khỏi album.

Nguồn: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [bucket restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets), [public asset URLs](https://supabase.com/docs/guides/storage/serving/downloads).
