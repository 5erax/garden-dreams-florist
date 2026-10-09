# Phát hành theo đặc tả v1 ngày 10/10/2026

Production phát hành phần giao diện tương thích database 001–004: lịch sử mua mới và tách tải account/admin/garden. Không đổi backend client, cột truy vấn orderColumns, trạng thái đơn, lưu token, phương thức thu tiền hoặc mở nhận đơn. 53 tests và production build qua; browser/session hosted/Core Web Vitals chưa kiểm chứng.

Nhánh `feature/bu-01-isolated-staging` tại `a825e76` lưu đầy đủ nguồn các lát cắt mới cùng SQL 006–011, 98 tests qua. `TRACEABILITY.md` mô tả phần đã có mã trên nhánh này, không khẳng định các chức năng đã cài trên production. Upgrade SQL chỉ dành cho project staging đúng baseline 005; chưa thực thi hosted.

Các commit nguồn theo chức năng:

- `10d6671`: lịch server, cutoff/capacity, giữ chỗ khi xác nhận, công cụ đo LOC.
- `049163c`: bàn xử lý đơn và ghi chú admin idempotent.
- `2df24b3`: route loading/recovery và cache riêng cho SSR tests Windows.
- `0b20b47`: lịch sử theo chủ đơn và giao diện/lọc có giới hạn rõ.
- `a825e76`: áp dụng tài liệu, yêu cầu đổi/hủy, audit/retention/rate limit và guarded staging upgrade.

Tiếp tục BU-14 sổ đối soát, sau đó fulfillment/role/branch/inventory/BOM theo contract v1. Giữ gates hosted/migration/concurrency/SMTP/backup trước khi nhận đơn thật. COD giao xong chưa có nghĩa đã thu tiền, cancel chưa có nghĩa đã hoàn tiền.

## Mua lại từ lịch sử — 10/10/2026

Port riêng BU-19a / ACC-F03 từ staging a23e990: preview hoa/cỡ/giá hiện tại, thêm phần còn bán vào giỏ có sẵn và dùng checkout hiện tại. Không sao chép địa chỉ/thiệp/ngày/phí/bank cũ hoặc tạo đơn từ thao tác mua lại. Catalog lỗi/chưa tải/chưa kết nối bị chặn. 68 production tests và build qua; 134 staging tests/build qua. Xem REORDER-FLOW.md.

Backend/Store/orderColumns/migrations production 001–004 được giữ nguyên. Ledger và migrations 005–012 chỉ ở staging; chưa cài hosted. Production tiếp tục đóng nhận đơn. Toàn đợt trên staging có 14.515 dòng canonical (+3.728/15.000, còn 11.272); không gọi đây là hoàn tất v1 hoặc BU-19 tổng. Browser/SMTP/RPC hosted và đa connection PostgreSQL chưa nghiệm thu.
# Brand release — 10/10/2026

PR #7 is merged. Production main `dc894b91232df887798c0efa314043dce858b454`, Vercel `dpl_HmW3jZc72jV4gA8jLsAuEoystWLE` READY with the main shop alias. Replaces default tool favicon, hero video and social preview with Garden Dreams flower assets; preserves approved catalog photos and backend scope. 68 production tests/build and staging tests/build pass. Store and Supabase browsing remain blocked by saved permissions. This does not certify 90% completion or enable orders; launch blockers in LAUNCH-STATUS remain applicable.

