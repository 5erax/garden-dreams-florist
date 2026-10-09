# Garden Dreams — vận hành bản commerce

Ngày 10/10/2026. Production Supabase: `ztzpipgptticvliotbsc`. Cửa hàng: https://garden-dreams-florist.vercel.app/ ; quản trị: https://garden-dreams-florist.vercel.app/#admin . Đăng nhập tài khoản chủ shop `dha260803@gmail.com` đã được cấp quyền. Không chia sẻ mật khẩu hoặc link khôi phục.

## Các thao tác hằng ngày

1. Trong Đơn hoa/Bàn xử lý đơn, kiểm tra địa chỉ, ngày giao, sản phẩm và khả năng chuẩn bị trước khi xác nhận. Xử lý lần lượt xác nhận → chuẩn bị → đang giao → đã giao. Ghi chú nhân viên là nội bộ.
2. COD và chuyển khoản bắt đầu ở trạng thái chưa thanh toán. Trong Đối soát tiền, chỉ ghi nhận thu khi thực tế đã nhận tiền; lưu tham chiếu/bằng chứng. Retry cùng thao tác không tạo khoản thu thứ hai. Hoàn tiền được ghi vào sổ sau khi shop thực hiện hoàn thực tế; website không tự chuyển tiền ngân hàng.
3. Trong Bộ sưu tập, sửa giá/trạng thái bán, album và cỡ bó. Giá đơn đã đặt được giữ theo snapshot, không đổi theo giá catalog mới. 20 mẫu và giá hiện tại được chủ shop chấp thuận.
4. Trong Giao hoa, quản lý dịch vụ/phí. Long Thành miễn phí; ngoài khu vực 30.000đ; xa hơn 50.000đ. Shop cần xác nhận phạm vi xa với địa chỉ thực tế trước khi nhận giao.
5. Lịch giao đã có nhưng kiểm soát lịch đang tắt. Chỉ bật sau khi chủ shop nhập giờ cắt đơn, ngày nghỉ và năng lực giao thực tế; không tự đặt năng lực giả.
6. Khách xem lịch sử, theo dõi, mua lại và gửi yêu cầu qua tài khoản. Yêu cầu thay đổi/hủy phải được shop xử lý theo trạng thái đơn. Thay địa chỉ cần shop kiểm tra lại phí; không có tự tính khoảng cách.
7. Kỉ niệm mặc định riêng tư. Với đơn thật đã giao và đã thanh toán, khách tự chọn công khai thông điệp, chia sẻ link hoặc rút công khai. Không công khai địa chỉ/số điện thoại.

## Cấu hình đã kiểm chứng

- Địa chỉ 665L, xã Long Phước, huyện Long Thành, tỉnh Đồng Nai; điện thoại 0832345780.
- COD và VietQR bật; MB Bank (970422), tài khoản 0832345780, Hà Văn Phước.
- `accepting_orders=true` đã có khi bắt đầu nâng cấp và được giữ nguyên. Không có thao tác tự bật mở bán trong release này.
- Hosted database nâng cấp 004→012 thành công. Một đơn cũ vẫn còn, không phát sinh thu tiền; 20 mẫu, ba vùng giao hoạt động, mọi bảng Garden Dreams bật RLS.
- 143 kiểm thử local và build production qua. Nghiệm thu SQL trên hosted staging qua cho phí COD, VietQR chưa trả, chống trùng, quyền khách, trạng thái đơn và công khai/rút kỉ niệm; tất cả dữ liệu thử được rollback.

## Các kiểm chứng còn thiếu

Auth production (email đăng ký, khôi phục và callback), UI trình duyệt desktop/mobile và quét QR bằng app ngân hàng chưa được nghiệm thu. Trình duyệt tiếp tục từ chối dashboard vì saved permission, dù MCP database đã được cấp quyền. MCP hiện không có công cụ sửa SMTP/template Auth. Không dùng đường vòng vượt chặn.

Gmail staging đã gửi thư theo báo cáo của chủ shop, nhưng template recovery hosted và thư rác vẫn chưa được xác minh sửa. Guest checkout chỉ hoạt động khi anonymous Auth provider được bật; hiện không được tuyên bố đã bật. Có thể sử dụng tài khoản email đã xác nhận để đặt đơn.

Vercel Hobby chỉ dành cho sử dụng cá nhân phi thương mại: https://vercel.com/docs/plans/hobby . Cần gói phù hợp hoặc hosting cho phép thương mại trước khi dùng kinh doanh; không mua/nâng gói tự động. Đây là bản production có chức năng thương mại, không phải xác nhận mọi điều kiện vận hành đã đạt.
