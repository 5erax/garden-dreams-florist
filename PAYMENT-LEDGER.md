# BU-14 — Đối soát COD/VietQR

Mã nguồn/local ngày 10/10/2026. Migration 012 thêm sổ thu/hoàn, số dư theo đơn, hàng đợi và báo cáo theo ngày ghi nhận đối soát giờ Việt Nam. Chưa tích hợp ngân hàng, thu hộ hoặc hoàn tự động.

Admin kiểm tra tiền thực tế, xác nhận checkbox, ghi căn cứ và tham chiếu tùy chọn. Chỉ ghi nhận toàn bộ tổng đơn snapshot từ máy chủ; form không nhận số tiền tự nhập. DELIVERED vẫn có thể UNPAID; CANCELLED chưa thu không nhận thêm tiền, PAID có thể hoàn toàn phần sau khi xử lý bên ngoài. Hoàn tiền giữ guard/revoke kỉ niệm. Hoàn một phần, approval nhiều người, bàn giao COD theo ca/chi nhánh và import statement còn ở backlog.

Khách chỉ xem số dư đơn mình, không thấy chứng từ/tham chiếu/actor. Admin đọc sổ tối đa 30 mục; queue tối đa 50+1 theo cursor timestamp nguyên, không trả thiệp/địa chỉ/điện thoại. Form tiến trình không đổi tiền khi capability mới bật. Client gd_update_order cũ vẫn dùng contract cũ, mọi thay đổi tiền tạo ledger trong cùng transaction.

gd_reconcile_payment giữ UUID/fingerprint/version/actor: mất ACK gửi lại nguyên thao tác, không ghi trùng; đổi nội dung trên cùng mã bị từ chối. Tham chiếu cùng phương thức/loại thu-hoàn chỉ dùng một lần nếu có cung cấp. Chứng từ mới chỉ ở sổ admin, không chép vào timeline khách/audit. Ghi chú tài chính trước migration vẫn giữ nguyên; chưa làm sạch lịch sử cũ.

Khoảng báo cáo tối đa 92 ngày inclusive theo Asia/Ho_Chi_Minh. Ngày là thời điểm server ghi nhận đối soát, không suy ngày giao dịch ngân hàng. Thu trừ hoàn trong kỳ có thể âm, không gọi là doanh thu/lợi nhuận. Đơn PAID/REFUNDED trước migration chuyển thành LEGACY opening snapshots, ngày/actor NULL, hiển thị riêng toàn thời gian và không tính là tiền mới trong kỳ. Production loại is_test khỏi queue/report.

## Rollout

- Staging tgvozhrkolcpszyyrgth baseline 001–005: dùng **supabase/staging-upgrade-005-to-012.sql**, một transaction, guard đúng staging/project/schema. Không chạy cả bundle 005→011 rồi 005→012; bundle 005→011 giữ cho release cũ.
- Nếu staging đã hoàn tất 011: sau backup/schema check, chạy riêng migrations/202610100012_payment_ledger.sql. Migration không dành cho rerun; lỗi rollback rồi kiểm tra schema trước khi thử lại.
- staging-setup.sql chỉ dành project staging trống hoàn toàn. Không chạy trên database có tài khoản/đơn.
- Production 001–004: không chạy bundle staging. Chuẩn bị rollout 005–012 theo môi trường production, backup và nghiệm thu hosted trước phát hành backend. Feature chỉ bật từ RPC khi schema có mặt; preview deploy không cài SQL hoặc mở nhận đơn.

## Kiểm chứng

10 SQL tests: quyền/private engine, tiền snapshot, retry/rollback/reference, client cũ, hoàn/revoke, loại đơn thử production, backfill và ranh giới ngày Việt Nam. 8 helper tests: intent recovery/confirmation/balance. Guarded upgrade kiểm production/rerun/rollback/giữ snapshot. Mutation tiền thành 1 và đảo điều kiện tham chiếu bị tests bắt; khôi phục xanh.

PGlite serial và build không chứng minh nhiều connection, keyboard/mobile hoặc RPC/Auth hosted. Còn ca thử admin/khách staging, mất ACK thật, đối chiếu báo cáo và backup hosted. Không phát hành backend lên production trước migration/acceptance.
