# Garden Dreams — triển khai phạm vi đã được xác nhận

Ngày 09/10/2026: chủ shop xác nhận sơ đồ module, COD/VietQR đối soát thủ công, lịch sử mua và chia sẻ chính thông điệp trên thiệp. Mặc định riêng tư; link chia sẻ và đưa vào vườn là hai lựa chọn. Không cần duyệt trước.

Thực hiện lần lượt: database và kiểm thử quyền → tài khoản/storefront → đặt đơn và thanh toán → lịch sử/chia sẻ → quản trị → kiểm thử trình duyệt → push/deploy.

Supabase PostgreSQL giữ nghiệp vụ trong migrations/RPC để giá tiền, quyền, trạng thái và tạo kỉ niệm được kiểm tra phía máy chủ. RLS bảo vệ bảng; mọi RPC security definer đặt search_path rỗng và kiểm tra quyền. Không đưa service-role key vào frontend. Phiên Auth giữ trong bộ nhớ, không localStorage. Mỗi đơn lưu snapshot giá/ship/bank để thay đổi cấu hình không thay đổi đơn cũ.

Vườn dùng cursor và tải tối đa 24 dấu mỗi lần; mỗi đơn chỉ tạo một kỉ niệm. Retry cùng request ID khác dữ liệu phải bị từ chối. COD/VietQR chỉ admin được xác nhận đã thu tiền.

Kiểm chứng SQL bằng PostgreSQL nhúng PGlite với vai trò anon/authenticated, hai khách và admin. Kiểm thử truy cập chéo, sửa giá, sửa trạng thái, quyền thanh toán, chia sẻ/rút chia sẻ, concurrency và một triệu kỉ niệm giả. Kiểm thử frontend trong trình duyệt. Dữ liệu thật trên Supabase chỉ cấu hình khi quyền truy cập tài khoản được mở.

Các files/spec giữ theo module id trong CAPABILITY-MAP. Không nâng gói trả phí hoặc tự gửi giao dịch/tin nhắn. API Blob cũ được gỡ khỏi luồng mới; frontend chưa nối backend vẫn hiển thị demo rõ ràng.
