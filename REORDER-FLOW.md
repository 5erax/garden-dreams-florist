# Mua lại từ lịch sử — BU-19a / ACC-F03

Ngày 10/10/2026. Lát cắt giao diện độc lập theo ưu tiên đưa cửa hàng vào sử dụng sớm; không đổi cổng bản A/B hoặc trạng thái nghiệm thu BU-19.

Trong đơn của mình, khách xem mẫu/cỡ hiện còn bán, giá mới, số lượng sẽ thêm và phần không còn khả dụng. Nút thêm mở giỏ có sẵn; giỏ hiện tại được giữ. Cỡ mất/tắt/sai sản phẩm không tự đổi sang Tiêu chuẩn. Giá, ngân hàng/phí/ngày giao/thiệp/người nhận của lịch sử không được dùng làm đơn mới. Checkout vẫn báo giá server và yêu cầu người nhận/lịch/consent mới.

Giữ giới hạn hiện có: 20 bó mỗi product/cỡ, tối đa 20 dòng khi thêm lựa chọn mới. Phần vượt giới hạn được báo trước; giỏ cũ hơn 20 dòng không bị cắt âm thầm. Catalog lỗi/chưa kết nối/chưa tải xong không cho thêm. Shop đóng vẫn cho chuẩn bị giỏ và hiển thị đúng trạng thái; thao tác này không tạo đơn hoặc xác nhận thu tiền. Request checkout chưa rõ kết quả vẫn được giữ bởi luồng cũ.

Thiết kế dùng khung paper/cream, serif heading và nút outline của account; trên mobile dòng giá xuống dưới, không ép chữ/ảnh vào ba cột. Có warning, empty/error/disabled states, semantic list và reduced motion. Tham chiếu hệ thống UI hiện có; browser không truy cập được để nghiệm thu layout thực tế.

12 helper tests kiểm giá/cỡ/quyền lựa chọn, giỏ/quantity/line limit, dữ liệu xấu và không sao chép PII; 3 SSR tests kiểm preview/connection gate/shop đóng. Mutation bỏ guard mẫu không còn bán bị test bắt. Full staging suite 134 tests và build qua. Chưa kiểm tương tác browser, keyboard/modal focus và hosted customer session. Không cần migration mới; có thể port riêng lên database production 001–004.
