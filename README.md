# Garden Dreams

Website hoa bằng React + Vite, giao diện tiếng Việt, video nền, hoa rơi, parallax và chuyển động khi cuộn. Dùng bảng màu, hình ảnh và video từ mẫu Flowers Are My Friend để phát triển storefront có mã nguồn chỉnh sửa được.

## Chạy local

Yêu cầu Node.js 24.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Những gì đã có

- 20 bó hoa, giá VNĐ, tìm kiếm, lọc theo dịp và sắp xếp giá.
- Chi tiết hoa, yêu thích, thêm/xóa/tăng/giảm số lượng và giỏ hàng lưu trong trình duyệt.
- Form người nhận, số điện thoại Việt Nam, địa chỉ, ngày giao, khung giờ và lời nhắn.
- Bản xem trước, sao chép nội dung đơn và liên kết Zalo/điện thoại `0832345780`. Khách tự gửi nội dung qua Zalo; website không tự gửi tin nhắn.
- Giao diện mobile, dialog có focus trap, phím Escape, reduced motion và trạng thái trống/lỗi.
- API Vercel `/api/orders` kiểm tra dữ liệu, tính tiền bằng giá máy chủ, lưu đơn riêng tư vào Blob khi được bật và chỉ báo thành công sau khi lưu.

## Trạng thái triển khai

Mặc định là **bản trải nghiệm**, với bộ sưu tập và giá mẫu. Form không gửi/lưu thông tin người nhận, không thu tiền và không báo giả rằng cửa hàng đã nhận đơn. Giỏ hàng được giữ khi xem trước hoặc gặp lỗi.

GitHub repository: `5erax/garden-dreams-florist` (private).
Vercel project: `garden-dreams-florist`.

Tài khoản Vercel hiện là Hobby; gói này chỉ cho mục đích phi thương mại. Cần gói phù hợp trước khi dùng website để bán thật: https://vercel.com/docs/plans/hobby.

Kho Blob riêng tư `garden-dreams-orders` đã tạo ở Singapore. Kết nối OIDC vào production/preview chưa được thực hiện vì bộ duyệt tự động yêu cầu người dùng xác nhận quyền truy cập này. Không có thông tin khách hàng trong kho.

## Bật nhận đơn thật

1. Xác nhận giá, ảnh sản phẩm, khu vực/chi phí giao, chính sách và quyền sử dụng thương mại của tài nguyên mẫu.
2. Chuyển hosting sang gói phù hợp cho kinh doanh.
3. Cho phép nối kho `garden-dreams-orders` vào đúng project Vercel bằng OIDC. Không để credential trong mã nguồn hoặc biến `VITE_`.
4. Đặt `VITE_SHOP_ORDERS_ENABLED=true` và `SHOP_ORDERS_ENABLED=true` rồi redeploy. `BLOB_STORE_ID` được thêm khi kết nối kho; SDK tự dùng OIDC.
5. Kiểm thử gửi yêu cầu với dữ liệu giả, lưu thành công và retry; cấu hình chống spam trước khi mở cho công chúng.

Đơn ở trạng thái `pending_confirmation`, thanh toán khi nhận và chưa có phí giao. Chủ shop xem đơn trong Vercel Storage; chưa có trang quản trị, email/SMS tự động, tồn kho hoặc thanh toán online. Không trả dữ liệu người nhận qua API công khai. Đơn cùng request ID được trả cùng mã tham chiếu để tránh tạo bản sao khi retry.

## Kiểm thử

`npm test` kiểm tra tổng tiền theo catalog, dữ liệu giỏ hỏng, sản phẩm/số lượng không hợp lệ, số điện thoại, consent, ngày giao theo giờ Việt Nam, phương thức/origin/body của API và việc chế độ demo không nhận đơn.

## Nguồn tài nguyên

- Mẫu tham khảo: https://21st.dev/@rockgaming755/templates/flowers-are-my-friend
- Demo gốc do Rock Gaming đăng: https://floweraremyfriend.netlify.app/
- Ảnh story được demo dùng từ Unsplash. Video nền và ảnh bó hoa được lấy từ demo công khai theo yêu cầu người dùng.

Mã ứng dụng trong `src/` và `api/` được viết mới. Không có mã React gốc của template và không kèm giấy phép thương mại cho ảnh/video của tác giả. Repository được tạo private; cần xác minh quyền dùng ảnh/video trước khi vận hành thương mại.
