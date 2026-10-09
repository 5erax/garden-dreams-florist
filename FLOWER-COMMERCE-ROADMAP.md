# Garden Dreams: bộ skill và lộ trình nghiệp vụ hoa

09/10/2026. Chủ shop yêu cầu cài/sử dụng các skill trong tài liệu đính kèm và tiếp tục build. Đây là đánh giá mã nguồn và đề xuất schema; chưa phải chức năng đã triển khai hoặc nghiệm thu.

## Kiến trúc hiện tại

React 19/Vite/Motion, CSS riêng, Supabase Auth + PostgreSQL/RLS/RPC, Storage ảnh sản phẩm được chuẩn bị và frontend Vercel qua GitHub. Giữ modular monolith: database thực hiện transaction/quyền/giá; React trình bày; worker độc lập xử lý tác vụ sau transaction khi cần. Không chuyển Next.js/Prisma/Redis hoặc Commerce Engine chỉ để dùng skill.

Đã có catalog, giỏ, checkout, tài khoản/lịch sử, COD/VietQR đối soát thủ công, trạng thái đơn, admin và thiệp/kỉ niệm opt-in. Album/cỡ/snapshot mới có migrations 006–008 và kiểm thử local, chưa cài hosted. Staging đã có 001–005; production 001–004, đóng nhận đơn. Chưa có inventory nguyên liệu, recipe, supplier, reservation nguyên liệu, branch, loyalty hoặc sổ chi phí/lợi nhuận. SMTP và các cổng nghiệm thu của [BIG-UPDATE-PLAN.md](BIG-UPDATE-PLAN.md) còn mở.

## Skill inventory và nguồn

Đã cài vào `~/.codex/skills` từ [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278), commit `063bee94c3f4df8453406c830b0a7df0f2860278`, qua installer có sẵn của Codex. Không chạy script bên thứ ba từ các skill.

| Skill/frontmatter | Thư mục đã cài | Áp dụng |
| --- | --- | --- |
| vercel-react-best-practices | react-best-practices | State dẫn xuất, import/bundle và các quy tắc React phù hợp; bỏ phần chỉ dành cho Next/RSC |
| web-design-guidelines | web-design-guidelines | Review code UI theo guideline mới lấy từ nguồn; kiểm thử browser là bước riêng |
| vercel-composition-patterns | composition-patterns | Dùng composition hiện có; không thêm hệ thống component nếu chưa cần |
| deploy-to-vercel | deploy-to-vercel | Project Git/Vercel hiện có, preview đã được chủ shop cho phép; giữ cổng production |

Plugin Vercel đang có một số hướng dẫn React/deploy tương tự. Không xóa/ghi đè plugin; ưu tiên một bộ quy tắc React trong mỗi lượt sửa, dùng plugin khi cần công cụ/cấu hình Vercel. Không tìm thấy 4 tên skill trên trong thư mục user trước cài. Tên folder upstream khác tên frontmatter là bình thường.

`ce-catalog`, `ce-cart-checkout`, `ce-orders`, `ce-webhooks`, `ce-seo` được tài liệu nêu là tùy chọn khi dùng Commerce Engine. Backend hiện tại không dùng Commerce Engine nên không cài/kết nối các skill đó. Không chạy lệnh `npx` không kiểm soát để cài backend mới.

Tạo 10 skill trong `.agents/skills/`: flower-commerce, bouquet-builder, flower-inventory, flower-delivery, order-management, revenue-analytics, multi-branch, payment-management, customer-loyalty, ecommerce-security. Mỗi skill có trigger/scope, invariant, workflow, tiêu chí kiểm chứng và xử lý lỗi. Chúng hướng dẫn module tương ứng khi được triển khai, không tự bật tính năng. Liên kết user skills tới các thư mục này để dùng cùng một bản nguồn.

## Đề xuất mô hình dữ liệu

Giữ `gd_products`, `gd_product_variants`, `gd_orders`, `gd_order_events`, `gd_memories`, `gd_shipping` và `gd_admin_audit`. Không sửa snapshot lịch sử từ catalog hiện tại. Các tên sau là đề xuất, chưa có migration:

| Module | Bảng/quan hệ đề xuất | Invariant |
| --- | --- | --- |
| Nguyên liệu | ingredients, suppliers, stock_batches, stock_movements | Đơn vị cơ sở rõ ràng; batch có hạn/cost; movement bất biến, không sửa tồn trực tiếp |
| Công thức | recipe_versions, recipe_lines theo product/cỡ | Version recipe được snapshot khi giữ nguyên liệu; thành phần có lượng/đơn vị hợp lệ |
| Giữ tồn | ingredient_reservations và allocations theo order/batch | Khóa batch, FEFO với hạn giao, giữ/nhả/trừ đúng một lần, không âm tồn |
| Lịch giao | calendars, slots, slot_reservations theo vùng/ngày | Năng lực hữu hạn, cutoff giờ Việt Nam, xác nhận/hủy đổi chỗ nguyên tử |
| Tiền | payment_events, refund_events, cost_entries | VND số nguyên; mã thao tác duy nhất; event đối soát tách tổng giá trị đơn |
| Chi nhánh | branches, staff_assignments, stock/slots theo branch | Mọi query/mutation có scope branch tại backend, migration dữ liệu cũ có default rõ |
| Loyalty | reward_events và coupon_redemptions | Ledger idempotent, reservation/hoàn điểm, không dùng lại voucher do retry |

Các event email/webhook cần transactional outbox sau khi nghiệp vụ đã ổn định. Worker dùng khóa/idempotency, retry giới hạn và trạng thái lỗi; không gửi từ render/browser. Chưa tạo tích hợp webhook hoặc gửi email mới.

## Lộ trình và phụ thuộc

Giữ 32 task hiện có và toàn bộ cổng phát hành. Việc bổ sung sau đây được chia theo milestone, không triển khai toàn hệ thống trong một diff:

1. **Nền tảng mua hàng**: tiếp tục BU-02–09 và các sửa UI được kiểm chứng trên staging. Chốt SMTP, quyền, luồng COD/VietQR, hosted migrations, dữ liệu/chính sách và backup trước mở bán.
2. **Vận hành giao hoa**: BU-10 → BU-11 → BU-12, lịch/năng lực/giữ chỗ và hàng đợi; sau đó BU-13–17 yêu cầu thay đổi, đối soát, giao việc, quyền và thông báo.
3. **Nguyên liệu**: FC-01 batch/movement/supplier → FC-02 recipe theo cỡ → FC-03 reservation/FEFO/tiêu hao/hủy → FC-04 hao hụt/cost. Mỗi lượt nối migration/RPC/admin và tests. Không tuyên bố kiểm soát tồn trước FC-03.
4. **Báo cáo**: BU-18 tiền thu/hoàn và công việc; FC-05 chỉ thêm gross/net profit sau FC-04 và sổ chi phí, không suy cost từ giá bán.
5. **Kỉ niệm và trải nghiệm**: BU-19–32 như kế hoạch hiện tại; các sửa nhỏ storefront không thay nghiệm thu bản A/B.
6. **Mở rộng**: FC-06 branch/role/migration trước branch fulfillment; FC-07 loyalty sau ledger đối soát; quotation/custom bouquet sau recipe và chính sách thay hoa. Promotions/reviews/SEO theo lát cắt riêng và schema được kiểm chứng.

Dependency graph: purchasing gates → delivery/operations → inventory → recipe → reservations → waste/cost → profit; branch scope → branch stock/delivery/reporting; payment ledger → loyalty; auth/outbox → email; immutable orders → memories. Không cần Redis/microservices trước khi đo được điểm nghẽn.

## Chiến lược kiểm chứng

- PostgreSQL/RLS: actor trái quyền, đầu vào lỗi, giá/quantity/tiền, version, retry và rollback; dữ liệu giả chỉ trong fixture/local hoặc staging có marker.
- Nghiệp vụ mới: hai request cùng batch/slot, hủy/retry, batch hết hạn theo ngày giao, đơn/cỡ cũ, recipe đổi sau giữ tồn, điều chỉnh stock và hoàn tiền; transaction phải giữ invariant.
- SDK hosted: cùng flow với phiên thử, so quyền và bảng/query thực tế; SQL local không thay hosted acceptance.
- UI: desktop/mobile, keyboard, lỗi mạng, form dài, quote đổi và giữ draft; SSR markup tests không thay tương tác/browser.
- Báo cáo: tổng ledger khớp fixture, phân biệt doanh số/tiền thu/công nợ/cost; truy vấn cursor/index/aggregate thay tải toàn bộ đơn lên browser.
- Ops: backup/restore thật, Cron/worker history, phát hiện retry lỗi; benchmark ghi rõ hạ tầng/dataset/quota, không coi một triệu kỉ niệm local là SLA free.

Khi rollout lỗi, giữ shop đóng với nghiệp vụ chưa nghiệm thu, ngừng worker lỗi và điều tra event/version; không xóa ledger/snapshot hoặc rerun setup trên database hiện hữu.
