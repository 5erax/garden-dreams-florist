# Kết nối Garden Dreams với Supabase

Repo chứa frontend và toàn bộ SQL cho backend. Supabase chạy PostgreSQL, Auth, RLS và RPC; Vercel chỉ phục vụ website. Không cần Vercel Blob/Functions để lưu đơn hay xác nhận thanh toán.

## 1. Tạo project

Trong Supabase Dashboard, tạo project Free mới, chọn khu vực gần Việt Nam. Giữ database password ở trình quản lý mật khẩu; không gửi password, secret key, service-role key hay access token vào chat/repo.

## 2. Cài database — chọn một cách

**SQL Editor, dễ nhất cho project mới:** mở [supabase/setup.sql](supabase/setup.sql), sao chép toàn bộ nội dung vào SQL Editor của project và Run. File chạy bốn migration theo thứ tự, gồm 20 bó hoa mẫu, cấu trúc dữ liệu, quyền và nghiệp vụ. Không tạo đơn, khách hàng hay admin giả. Chỉ chạy một lần trên project mới; không dùng trên database đã cài hệ thống này.

**CLI, để quản lý lịch sử migration:** clone repo, vào thư mục repo rồi chạy:

```sh
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Project ref nằm trong URL dashboard. Nhập database password trực tiếp khi CLI yêu cầu. Không chạy cả SQL Editor rồi `db push` trên cùng project: cài thủ công không ghi lịch sử CLI. Các thay đổi tiếp theo phải được lưu thành migration mới. [Tài liệu migration chính thức](https://supabase.com/docs/guides/deployment/database-migrations).

## 3. Auth và admin đầu tiên

- Authentication → URL Configuration: Site URL `https://garden-dreams-florist.vercel.app`; cho phép redirect `https://garden-dreams-florist.vercel.app/#account`. Thêm URL của hosting mới nếu chuyển frontend.
- Bật Email Auth và xác nhận email; đặt mật khẩu tối thiểu 12 ký tự. Cấu hình SMTP cho email đăng ký/khôi phục gửi tới khách thật; dịch vụ email mặc định có hạn chế, cần kiểm thử gửi và nhận trước khi mở cửa hàng.
- Chủ cửa hàng đăng ký/xác nhận email từ trang `/#account` sau khi website đã nối backend. Sau đó chủ project chạy SQL bên dưới, thay email bằng email tài khoản của mình:

```sql
insert into public.gd_admins(user_id)
select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict do nothing;
```

Kiểm tra truy vấn đã cấp đúng một tài khoản. Khách không có quyền tự thêm admin. Đăng nhập lại rồi mở `/#admin`.

## 4. Nối website

Lấy Project URL và **publishable key** trong phần kết nối/API của project. Legacy `anon` key cũng được hỗ trợ. Hai giá trị frontend này được thiết kế để công khai; quyền bảo vệ dữ liệu nằm trong Auth/RLS/RPC.

Vercel → Project → Settings → Environment Variables, thêm:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Chọn production; chỉ thêm preview nếu bạn muốn preview dùng chung database. Redeploy vì Vite nhúng cấu hình lúc build. Với local: sao chép `.env.example` thành `.env.local` và điền hai giá trị. Không dùng service-role/secret key hoặc database password trong biến `VITE_`.

## 5. Cấu hình trước khi nhận đơn

Mặc định cửa hàng đóng nhận đơn, dịch vụ ship chưa hoạt động, chuyển khoản chưa bật. Admin cập nhật tên, giới thiệu, điện thoại, hoa/giá, khu vực/phí ship. Nhập mã BIN ngân hàng, số tài khoản, tên ngân hàng và chủ tài khoản khi bật VietQR. Kiểm tra QR bằng ứng dụng ngân hàng và đối chiếu người nhận, số tiền, mã đơn; không chuyển tiền kiểm thử tới tài khoản giả.

VietQR được sinh tại thiết bị khách từ snapshot đơn. COD/chuyển khoản chỉ được ghi nhận đã trả sau khi admin đối soát và nhập ghi chú. Nút ghi nhận hoàn tiền chỉ lưu trạng thái, không chuyển tiền ra ngân hàng. Ship được quản lý theo dịch vụ và khu vực mô tả; admin kiểm tra địa chỉ thực tế, chưa tự gọi hãng vận chuyển.

Bật Supabase Cron/pg_cron bằng cách chạy [supabase/retention.sql](supabase/retention.sql) trong SQL Editor. File tạo/cập nhật cùng một tác vụ có tên, xóa thông tin giao hàng của đơn hoàn tất/hủy sau 90 ngày kể từ cập nhật cuối; lời nhắn và lịch sử vẫn được giữ. [Cài Cron](https://supabase.com/docs/guides/cron/install), [lập lịch](https://supabase.com/docs/guides/cron/quickstart).

Nếu extension đã bật, câu lệnh lập lịch là:

```sql
select cron.schedule(
  'garden-dreams-expire-contacts',
  '0 20 * * *',
  'select public.gd_expire_contacts();'
);
```

20:00 UTC là 03:00 giờ Việt Nam. Kiểm tra lịch sử Cron và xuất backup định kỳ. Lời nhắn và lịch sử đơn được giữ cho khách; thông tin người nhận không xuất hiện trong thiệp công khai. Nếu khách tự ghi thông tin cá nhân vào lời nhắn thì việc chia sẻ sẽ công khai chính nội dung họ chọn.

## 6. Kiểm tra luồng thật

Tạo hai khách thử: đặt đơn, retry cùng mã không tạo bản sao, khách thứ hai không thấy đơn khách thứ nhất. Admin chuyển đơn qua xác nhận → bó hoa → giao → đã giao, đối soát thanh toán. Chỉ đơn đã giao + đã trả mới tạo một kỉ niệm, mặc định riêng tư. Khách chọn link hoặc công khai vào vườn; người khác mở link không cần đăng nhập. Rút chia sẻ phải làm link cũ không còn xem được. Không ghi nhận thanh toán thật từ dữ liệu kiểm thử.

## Giới hạn hiện tại

Đã nối project Supabase thật `ztzpipgptticvliotbsc` ngày 09/10/2026. Chủ project đã chạy setup.sql; API công khai đọc được catalog, vườn trống và không đọc được bảng riêng. Chủ shop xác nhận đã tạo/xác nhận tài khoản, chạy SQL cấp admin và cài Cron retention với active=true. Phiên admin và lịch sử Cron chưa kiểm chứng trực tiếp qua công cụ. Các biến Vercel chỉ gồm URL/publishable key, chỉ áp dụng production; không lưu password database. UI mới chưa được kiểm tra bằng trình duyệt; SQL và tích hợp SDK được kiểm thử local. Chưa kiểm thử SMTP hoặc QR bằng ứng dụng ngân hàng thật. Phiên đăng nhập giữ trong bộ nhớ; tải lại trang cần đăng nhập lại. Thiệp dùng hash URL, chưa có ảnh preview mạng xã hội riêng cho từng thiệp.

Supabase Free phù hợp bắt đầu thử, không có cam kết đủ dung lượng cho một triệu đơn/kỉ niệm. Thiết kế dùng index/cursor và mỗi đơn một dấu; dung lượng đơn, thông điệp, index, backup và tải thực tế vẫn phải đo trên hosting thật. Vercel Hobby hiện dành cho mục đích phi thương mại; chọn hosting phù hợp và xác minh quyền ảnh/video trước khi bán. Không có gói trả phí nào được bật trong thay đổi này.
