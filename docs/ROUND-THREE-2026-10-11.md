# Đợt 3 — sửa vận hành và thông báo (11/10/2026)

Đã sửa giao diện kho, điều kiện bật tồn, CSV tiếng Việt, thanh toán render một lần, nhật ký không lộ UUID, bảng cuộn ngang, header admin gọn, ngày giờ/tiền tiếng Việt, bộ lọc và nút mua luôn hiện, ảnh thiếu không cho đặt, SEO mẫu thiếu ảnh không vào sitemap. Slug mã số đã đổi sang tên; URL cũ chuyển hướng.

Nghiệp vụ: quá giờ giao thống nhất giữa Tổng quan và Bàn xử lý; đơn trễ phải đổi lịch hoặc hủy trước khi xác nhận. Đổi lịch kiểm tra phiên bản, sức chứa và hạn nguyên liệu. Chỉ ghi thu sau xác nhận; VietQR bắt buộc tham chiếu. Có thu/hoàn từng phần, số còn phải thu lấy từ sổ máy chủ.

Thông báo: đơn mới thật được đưa vào hàng đợi riêng. Vercel dùng ADMIN_SMTP_PASSWORD đã lưu, ADMIN_SUPABASE_SERVICE_KEY và ADMIN_NOTIFICATION_SECRET chỉ ở máy chủ. Supabase Cron gọi mỗi phút khi có việc. Không gửi thông tin riêng người nhận/thiệp qua email. Tối đa năm lần thử lỗi rõ ràng; lỗi SMTP không rõ kết quả chuyển UNKNOWN để kiểm tra, không tự gửi lại. Không gửi lại các đơn cũ hoặc đơn thử.

Lịch khởi đầu hằng ngày: mỗi buổi sáng 9–12 và chiều 13–17 tối đa 5 đơn trên tổng ba vùng (3 Long Thành, 1 ngoài Long Thành, 1 vùng xa). Sáng chốt 20:00 hôm trước, chiều 11:00. Ngày 19–20/10 tổng 20 đơn nếu chưa có đơn chiếm chỗ. Đây là ước tính thận trọng, không phải số lượng đơn đo được của shop khác. [Lacy Bird](https://lacybird.com/guides/how-to/hand-tied-bouquet/) mô tả 15 phút cho bó 30 cành ở người có kinh nghiệm, 30–45 phút khi mới làm; dự trù thêm đóng gói, liên hệ và giao. Giới hạn là theo đơn, không phải số bó, nên cần theo dõi các đơn nhiều bó và hạ sức chứa nếu thiếu người. Có thể điều chỉnh trong Lịch giao.

Còn cần dữ liệu shop: tồn thật, công thức từng mẫu/cỡ, ảnh thật của năm mẫu đang thiếu, phạm vi xã/phường cho ba mức phí, tên pháp lý và đăng ký khi có. Không tự tạo tồn hoặc công thức giả. Chưa có kết nối Search Console và chưa xác nhận hiệu quả SEO.

Chưa hoàn tất các đề xuất mở rộng: địa chỉ có cấu trúc, nhãn tên từng nhân viên và rút ngắn mã đơn cũ. Mã mới đã ngắn; mã cũ giữ để khách tra cứu. Chưa đo Core Web Vitals hoặc kiểm tra giao diện bằng trình duyệt trong đợt này do quyền truy cập bị chặn.

Kết quả triển khai: 198/198 kiểm tra qua; build production và staging qua, 40 trang sản phẩm/16 URL sitemap. Production đã READY. Sau khi thay mật khẩu ứng dụng và redeploy production, kiểm tra SMTP trả 200 smtpVerified=true; email kiểm tra trả 200 smtpAccepted=true tới dha260803@gmail.com. Đã bật Cron garden-dreams-order-email mỗi phút (job 2). Gmail đã nhận yêu cầu gửi; chưa xác nhận thư vào Inbox hay Spam.
