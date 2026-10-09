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
