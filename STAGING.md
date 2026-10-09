# Môi trường thử Garden Dreams

Production: `ztzpipgptticvliotbsc`. Staging: `tgvozhrkolcpszyyrgth`. Hai project có database, Auth và cấu hình riêng. Không sao chép khách, đơn, password hoặc bearer token từ production sang staging.

## Cấu hình website

Vercel production giữ URL/key production. Preview chỉ có URL/key staging và `VITE_APP_ENV=staging`; production dùng `VITE_APP_ENV=production`. Không chọn cả hai target khi lưu biến Supabase. Vite kiểm tra project ref, loại public key và môi trường trước khi build. Preview trỏ production bị từ chối ngay cả khi khai báo `VITE_APP_ENV=production`.

Với staging local, tạo `.env.staging.local` (được gitignore):

```dotenv
VITE_APP_ENV=staging
VITE_SUPABASE_URL=https://tgvozhrkolcpszyyrgth.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_STAGING_PUBLISHABLE_KEY
```

Chạy `npm run dev -- --mode staging` hoặc `npm run build -- --mode staging`. File theo mode được Vite ưu tiên hơn `.env.local`; biến từ môi trường shell còn có thể ghi đè nên phải kiểm tra trước khi chạy. Không chép cấu hình production vào file mặc định. [Vite env/mode](https://vite.dev/guide/env-and-mode).

Để thử transport local, dùng URL `http://127.0.0.1:54321`, key giả `sb_publishable_local_test_only` và `VITE_APP_ENV=local`. Không khai báo cấu hình backend để chạy bản demo: URL/key rỗng, `VITE_APP_ENV=demo`. `scripts/e2e-server.mjs` và `scripts/check-flow.mjs` cố định loopback; benchmark dùng PGlite in-memory, không nhận connection string remote.

## Cài database và nghiệm thu

Trên **SQL Editor của project `tgvozhrkolcpszyyrgth`**, chạy toàn bộ [supabase/staging-setup.sql](supabase/staging-setup.sql) một lần trên database mới. File gồm migrations 001–005 và cấu hình staging, từ chối database đã có schema Garden Dreams hoặc tài khoản. Không tạo khách, admin, đơn, kỉ niệm hay thông tin ngân hàng giả. Giữ đóng nhận đơn đến khi chuẩn bị tài khoản thử và kiểm chứng quyền.

Kết quả cuối phải là `environment=staging`, `projectRef=tgvozhrkolcpszyyrgth`. Nếu đã cài migrations 001–004 riêng, chỉ áp dụng [migration 005](supabase/migrations/202610090005_environment.sql), rồi [staging-init.sql](supabase/staging-init.sql) trước khi tạo tài khoản/đơn thử. Cấu hình runtime không đổi được sau khi có đơn.

Production chỉ áp dụng migration mới 005 khi tới bước nghiệm thu tương thích; không chạy staging setup hoặc chạy lại `setup.sql`. Không dùng `supabase db reset --linked` trên production. Không bật nhận đơn production khi nghiệm thu. [Supabase environments](https://supabase.com/docs/guides/deployment/managing-environments).

Database tự đặt `gd_orders.is_test`, giữ loại đơn bất biến và truyền cờ sang kỉ niệm. `gd_memory_count` và projection tài chính `gd_private.real_orders` loại đơn/kỉ niệm thử. Vườn sandbox vẫn cho xem các thiệp thử để kiểm tra chia sẻ; production loại thiệp thử khỏi các public RPC. Frontend kiểm tra runtime khớp môi trường/project trước thao tác dữ liệu và hiển thị nhãn môi trường thử.

Tái tạo file staging setup sau khi thêm migration: `node scripts/build-staging-sql.mjs`, rồi test file sinh ra bằng `node --test tests/staging.test.js`. Generator chỉ viết file SQL, không nối database. Không sửa migrations 001–004 đã áp dụng. File setup production cũ vẫn gồm 001–004; project mới cũng phải áp dụng 005 trước khi dùng phiên bản frontend này.

BU-01 chỉ được đánh dấu xong sau khi API thật xác nhận runtime là staging, database có cờ đơn thử do server đặt, preview build thành công với đúng project và kiểm chứng truy cập riêng tư. Build hoặc tests local không thay bước này. Kết quả nằm trong [tasks/progress.md](tasks/progress.md).

Email Auth staging cấu hình URL callback riêng của preview. Tài khoản thử không có quyền trên project production. Khi chưa có SMTP, chưa nghiệm thu khả năng gửi email tới khách; chuẩn bị SMTP ở BU-02.
