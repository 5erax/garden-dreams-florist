# Áp dụng đặc tả bán hoa v1 vào Garden Dreams

Ngày 09/10/2026, chủ shop yêu cầu tạm dừng triển khai cũ để nhận và áp dụng tài liệu Word. File gốc được giữ nguyên tại `flower-commerce-functional-business-rules-v1.docx`; SHA-256 `8dfbbc21a90d7a9378315ee08310f9851343021653d6e893eacbeb635059f094`. Nội dung trích gồm 95 chức năng, 17 domain, 7 workflow, 12 acceptance scenario và 10 quyết định mở. Tài liệu nguồn tự ghi trạng thái Draft; việc tiếp nhận không tự xác nhận các thông số còn thiếu.

## Phạm vi và những quyết định đã có

Giữ một thương hiệu Garden Dreams; cửa hàng hiện có ở Long Thành là điểm thực hiện đầu tiên. Không tạo marketplace, hệ thống chia tiền hoặc đổi stack. PostgreSQL/RLS/RPC giữ transaction, quyền, giá và state; React/Vite dùng các API này, frontend triển khai Vercel. Cấu hình/hosting ưu tiên miễn phí như chủ shop yêu cầu, không bảo đảm SLA enterprise từ gói miễn phí.

DEC-03 đã có quyết định: COD và chuyển khoản MB/VietQR, chỉ admin kiểm tra mới ghi nhận tiền. Guest checkout dùng danh tính Auth nếu provider đã bật; chưa xác thực bằng số điện thoại người nhận. Không tự thêm PSP/OTP/SMS trả phí hoặc xác nhận PAID từ thông báo trình duyệt.

DEC-02 đã biết địa chỉ shop và mức phí: Long Thành miễn phí, ngoài khu vực 30.000đ, xa hơn 50.000đ. Ranh giới “xa hơn”, đơn vị giao và khả năng giao lại chưa được xác định. Chưa hứa phí bằng một thuật toán khoảng cách hoặc tự chọn đối tác. Địa chỉ mới phải kiểm tra lại dịch vụ, phí và ca trước khi áp dụng vào đơn.

Vườn kỉ niệm vẫn theo quyết định trực tiếp của chủ shop: một dấu/đơn thật đã giao và trả tiền; riêng tư mặc định, khách tự nguyện chia sẻ đúng thông điệp của mình bằng link hoặc đưa vào vườn, không cần admin duyệt. Không dùng rule kiểm duyệt review trong CRM-F04 để tự áp vào thông điệp kỉ niệm.

DEC-04–10 còn thiếu các ngưỡng/chính sách cụ thể: phí hủy sau sản xuất, thay hoa tương đương, TTL, công suất, UoM/QC, VAT/chứng từ, kỳ doanh thu, B2B/subscription, tải/RPO/RTO. Chuẩn bị cấu hình và invariant an toàn; không xuất bản ngưỡng đoán thành chính sách bán hàng. NFR 99,9%, p95, WCAG và peak là mục tiêu cần kiểm nghiệm, chưa phải kết quả đo hoặc cam kết.

## Domain model và tương thích trạng thái

| Domain | Nguồn hiện tại | Bất biến áp dụng |
|---|---|---|
| Identity | Supabase Auth, owner_id, gd_admins | Buyer độc lập recipient; server authorize; customer corner lọc owner dù user cũng là admin. |
| Catalog/pricing | Product, variant, version | SKU/ID ổn định, giá server, snapshot cũ không đổi theo catalog. |
| Checkout | Order intent UUID và hash | Retry cùng intent không tạo đơn mới; kết quả mất ACK có đường khôi phục. |
| OMS | gd_orders, gd_order_events, gd_order_requests | Request không tự hủy; chấp thuận kiểm tra current state trong transaction. |
| Delivery | Rules, closures, order calendar snapshot | Asia/Ho_Chi_Minh, cutoff/capacity; managed mode tắt cho đến khi shop cấu hình. |
| Payment | Manual payment state hiện tại | Delivered độc lập paid; cancel không tự refund; chưa có partial refund ledger. |
| Memories | gd_memories | One/order, exact card opt-in, public payload không PII người nhận. |
| Inventory/BOM | Chưa triển khai | Không coi active catalog là ATP; reservation cần ledger/FEFO/expiry/QC. |
| Branch/staff | Chưa triển khai | Phân quyền theo branch tại server trước khi mở staff portal. |
| Finance | Tổng trạng thái đơn hiện tại | Gắn kỳ/ngày và định nghĩa; không gọi tiền đã thu là doanh thu/lợi nhuận. |

Không đổi tên trạng thái đã có trên đơn production hoặc phá client cũ để giống hình state machine trong tài liệu. Chuỗi hiện tại `PENDING → CONFIRMED → PREPARING → SHIPPING → DELIVERED`, có CANCELLED và payment độc lập. PENDING là yêu cầu chờ shop, không tự đồng nghĩa PENDING_PAYMENT. Chuỗi chuẩn bổ sung ALLOCATED/READY/FAILED qua fulfillment/work order/shipment và migration có tương thích; chỉ tuyên bố đã đạt khi guard production/QC/POD thực sự được nối.

Khách chỉ đề nghị CANCEL trước sản xuất hoặc sửa tên/điện thoại tại cùng địa chỉ. CONTACT giữ snapshot địa chỉ; server từ chối địa chỉ khác bằng ADDRESS_REQUOTE_REQUIRED. Quy trình re-quote đổi địa chỉ/date/zone và approval sau allocation còn ở backlog; không cho form correction lách định giá lại.

## Thứ tự triển khai và nghiệm thu

1. Nối nguồn yêu cầu vào backlog BU/FC và traceability; giữ nguyên các gate hosted/SMTP/backup chưa đạt.
2. Hoàn thiện P0 hiện có: tài khoản/lịch sử, request support, lịch giao, manual reconciliation/audit. Kiểm quyền/retry/version/rollback; giữ shop đóng trong khi nghiệm thu.
3. Chi nhánh đầu tiên và staff scope → nguyên liệu/supplier/lô/QC/movements → BOM phiên bản → reservation/FEFO/consume/release. ATP chỉ hiển thị sau khi chuỗi này kiểm được.
4. Work order/QC → điều phối/POD/giao thất bại → COD bàn giao/ledger/refund → báo cáo có kỳ và số liệu truy vết.
5. Outbox/worker/templates có dedupe/retry/DLQ; chỉ gửi kênh đã cấu hình. Promotions/coupon giữ quota trong transaction.
6. Multi-branch/P1 sau P0, rồi loyalty/B2B/POS/subscriptions/P2 theo nghiệp vụ đã chốt. Tiếp tục mục tiêu thêm 15.000 LOC bằng các chức năng thực, không thêm dòng để bù số.

AT-01/02/03/06/09 là gate P0 end-to-end theo nguồn. Một build hoặc SQL nhúng không chứng minh được concurrency hosted, gửi email, POD hay banking. PR phải nêu ID yêu cầu/rule, migration, kiểm thử và các phần chưa nghiệm thu; production không tự mở nhận đơn khi preview READY.

## Áp dụng đầu tiên sau khi nhận nguồn

- ACC-F03/ACC-BR02/SEC-BR01: lịch sử mua responsive, owner scope rõ, tìm/lọc trong phần đã tải và focus trở về đơn; không coi summary partial là thống kê toàn tài khoản.
- OMS-F01/OMS-F03/OMS-BR03–05/DLV-BR02: gửi/rút/duyệt yêu cầu với UUID, version, lý do và timeline; chỉ correction người nhận cùng địa chỉ, cancel không tự refund.
- SEC-F06: bản sao tên/điện thoại/địa chỉ trong proposal được xóa cùng transaction retention của đơn; không lưu lại chúng trong public event hay hash plaintext.
- INT-F03/NFR performance: tách tải các trang admin/customer/garden, retry giữ phiên hiện tại. Đo bundle chỉ là kiểm build, chưa phải Core Web Vitals trên người dùng.

Xem `TRACEABILITY.md` để đối chiếu toàn bộ 95 chức năng và AT; “một phần” không được đổi thành “đã hoàn thành” dựa trên tên component hoặc bảng chưa dùng.
