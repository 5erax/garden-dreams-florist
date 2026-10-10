# Garden Dreams — kiểm tra mở bán 10/10/2026

Kết luận: bản sửa có thể dùng để kiểm tra vận hành, chưa đủ bằng chứng để tuyên bố mở bán thương mại đại trà. Không có phần trăm hoàn thiện được nghiệm thu. Bản Word có 95 chức năng: 40 một phần, 55 chưa triển khai; xem docs/product/TRACEABILITY.md.

## Phạm vi đợt này

- Sửa trang riêng trắng: publicCatalog thiếu occasion trong snapshot; ProductDialog gọi onClose dù trang inline không có callback. Bổ sung occasion, active, reference_only; fallback cho snapshot cũ; đóng popup chỉ khi có callback.
- Trang riêng có điều hướng về root; header nền sáng dùng màu dễ đọc. Kiểm tra bằng trình duyệt cục bộ thực tế: thêm giỏ, quay về collection, 390px không tràn ngang.
- Dùng BloomLoader hoa năm cánh ở lazy route, lịch sử, kho, giao nhận, vườn kỉ niệm và đối soát. Catalog có snapshot vẫn hiển thị khi refresh. Prefetch account/garden khi hover/focus. Không cố giấu lỗi; catalog dịch vụ trống sau tải xong hiện lỗi và nút thử lại, không giữ loader vô hạn.
- 20 loài/mẫu tham khảo mới, mỗi mẫu có ảnh riêng, mô tả, dịp tặng, thành phần gợi ý, chăm hoa và giá dự kiến. Ảnh được kiểm tra trực quan, có attribution/giấy phép trong gallery và HTML máy chủ; nguồn ở public/flowers/REFERENCE-PHOTO-CREDITS.md. Không phải ảnh hàng thật của shop; chưa công bố số cành/kích thước giả.
- Schema 014 reference_only: public chỉ xem mẫu đang bán hoặc mẫu tham khảo được công bố; bản nháp khác vẫn kín. Mẫu tham khảo active=false không đặt được, cả UI và gd_create_order. Admin bật active sẽ tự xóa reference_only; giữ version/audit. Seed khóa bảng, cấp ID theo max hiện có, chạy lại không nhân đôi ảnh/mẫu và không sửa 20 mẫu đang bán hay đơn cũ.

## Chức năng và luật nghiệp vụ

| Nhóm | Bằng chứng hiện có | Giới hạn vận hành |
|---|---|---|
| Catalog/tìm hoa/giỏ/variant | Tìm không dấu, URL riêng, album, yêu thích, cỡ và giá; SSR snapshot và test root/product | Chưa có autocomplete/synonym, lọc màu/mùa, cross-sell phụ kiện đầy đủ |
| Đặt nhanh | Checkout một form; guest session được provider-gate; báo trạng thái và giữ requestId khi kết quả chưa rõ | Owner đã bật anonymous; advisor production nhận diện chế độ này. Chưa chạy một đơn guest thật qua trình duyệt production trong đợt này |
| Tiền/đặt trùng | Server tính giá/phí, kiểm tra expectedTotal; RPC idempotency, giới hạn đơn và kiểm tra version | Không tự coi hiển thị QR/COD là đã thu tiền |
| Giao/đơn | Vùng/phí, lịch giao/capacity engine, lifecycle, bàn xử lý, owner history, yêu cầu thay đổi/hủy | Shop phải xác nhận vùng 30k/50k, giờ làm/cutoff và khả năng giao thật; lịch capacity chưa được nghiệm thu bằng lịch thật |
| COD/VietQR/thu/hoàn | QR nội dung/tiền đúng snapshot; full collection/full refund ledger, net cash report, chống lặp đối soát | Chuyển tiền/hoàn tiền thật và xác nhận bằng admin vẫn thủ công theo lựa chọn của shop; chưa thu/hoàn một phần hoặc kết nối ngân hàng tự động |
| Kho/BOM | Engine lô hết hạn trước, giữ tồn, thiếu tồn rollback, tiêu hao, hủy, hao hụt; admin nhập lô/công thức; tests và staging rollback acceptance | Production chưa có lô hay công thức, inventory=false. Chưa thể chống quá bán thực tế cho đến khi nhập dữ liệu thật và bật kiểm soát |
| Kỉ niệm | Chỉ đơn giao và trả tiền, tự nguyện công khai, một đơn/một dấu ấn; revoke, share; owner riêng tư | Chưa thử tải một triệu kỉ niệm hoặc vận hành moderation/spam quy mô lớn |
| Quản trị/quyền | Catalog, giá, giao, thanh toán, đơn, kho; RLS owner/admin, audit/version | Chưa đủ xưởng/QC, đa chi nhánh, loyalty, coupon, tự động thông báo, định tuyến shipper theo Word |

Đọc production trước seed: accepting_orders=true, COD=true, transfer=true; 20 mẫu active, 5 ảnh giữ chỗ; 3 dịch vụ; 2 đơn hiện hữu; 0 công thức, 0 lô tồn, inventory=false; mọi bảng public gd_* có RLS. Không mở/tắt nhận đơn, không sửa đơn, không tạo tồn giả.

## SEO

- Root và /hoa/bo-hoa-ID có HTML sản phẩm/giá trước JavaScript, URL ổn định, canonical, Product/Florist JSON-LD, OpenGraph và sitemap; robots.txt; preview noindex. Public HTML không truy cập dữ liệu đơn/khách.
- Đã sửa dữ liệu snapshot gây crash. 20 mẫu tham khảo có giá dự kiến, không có Offer trong JSON-LD và không quảng cáo nút đặt ngay. Attribution được escape trong HTML/script.
- Hero chỉ preload ở root; font WOFF2, cache ảnh/media, ảnh lazy; không tải video hero cũ. 20 JPG mới khoảng vài MB tổng, chỉ tải khi đi đến ảnh; chưa đo Core Web Vitals production hoặc mạng 3G.
- Các section #collection/#story vẫn thuộc URL root, chưa có landing category riêng. Slug bo-hoa-ID ổn định nhưng chưa là slug có từ khóa. Chưa xác minh Google index/Search Console, Lighthouse, Rich Results hoặc SEO địa phương bằng Google Business Profile.

## An toàn và kiểm tra

- Production/staging migration thêm cột, policy và trigger; không drop bảng/cột hoặc thay tiền lịch sử. Staging rollback kiểm tra activation; local test public reference read, private draft hidden, buyer không sửa được catalog, RPC không mua reference, seed hai lần không trùng.
- npm audit --omit=dev: 0 vulnerabilities. Security advisors không có ERROR; vẫn có WARN cho security-definer RPC, leaked-password protection và các policy authenticated khi anonymous bật. Kiểm tra policy: gd_orders theo owner UID/admin, gd_admins theo UID, catalog write theo is_admin; cron theo username=CURRENT_USER. Các cảnh báo không có nghĩa đã nghiệm thu mọi luồng bảo mật hosted. Tham khảo [anonymous policies](https://supabase.com/docs/guides/database/postgres/row-level-security#anonymous-user-vs-anonymous-key), [security-definer lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Full local suite cuối đạt 158/158, gồm empty-shipping và root/product render. Build production pass, kiểm tra diff sạch whitespace. Kết quả suite cuối ghi trong tasks/progress.md.
- Motion review: Approve trên mã cho loader báo trạng thái (src/bloom-loader.css:4), chỉ opacity, dừng khi component hết chờ, reduced-motion tắt animation (line 9). 1.8s là nhịp báo chờ, không phải thời gian khóa chuyển trang. Không có số đo FPS thiết bị thật.

## Việc bắt buộc trước mở bán thật

1. Hosting thương mại: Vercel API xác nhận plan=hobby ngày 10/10. [Hobby chỉ dành cho phi thương mại](https://vercel.com/docs/plans/hobby). Chọn gói/hosting cho phép bán hàng; chưa mua gói tự động.
2. Chạy acceptance production bằng khách thử: guest/COD/VietQR, gửi lại cùng requestId, admin nhận/đổi trạng thái, lịch sử và chia sẻ/revoke; đối chiếu ngân hàng bằng app thật. Browser saved-policy vẫn chặn hosted dashboard/storefront ở lần trước; không dùng đường vòng. Local UI và database MCP không thay thử nghiệm hosted này.
3. Chốt hàng thật: 5 mẫu cũ thiếu ảnh thực tế; 20 mẫu mới chỉ tham khảo. Chụp/upload ảnh, xác nhận giá, số cành, kích thước, nguồn hoa và lịch trước khi admin bật bán mẫu mới. Nhập công thức/lô thật rồi bật kho nếu muốn chống quá bán tự động; nếu chưa bật thì shop cần duyệt khả năng cung cấp trước khi nhận thực hiện.
4. Kiểm chứng SMTP production: reset template đúng, callback/URL đúng, thư vào inbox, recovery đổi mật khẩu đúng. Guest không cần email để đặt nhưng khôi phục và gắn email cần luồng này.
5. Người trực shop theo dõi đơn và xử lý giao/thu/hoàn; bổ sung thông báo tự động để tránh bỏ đơn. Chốt vùng xa/phí, giờ nhận/giao, chính sách thay hoa/hủy và kênh liên hệ.
6. Sao lưu/khôi phục hosted và diễn tập mất phiên/mất kết nối. Có restore local synthetic và retention job, chưa có hosted restore acceptance hay tải đồng thời nhiều kết nối.

Coupon, loyalty, xưởng/QC và đa chi nhánh là scope mở rộng còn thiếu; không phải điều kiện kỹ thuật bắt buộc của một shop nhỏ, nhưng chưa thể nói đã đáp ứng tài liệu nghiệp vụ lớn.

## Phát hành và rollback

Triển khai mã/ảnh trước, xác nhận Vercel READY đúng SHA, rồi seed 20 mẫu inactive/reference_only vào từng project qua official MCP. Thêm schema không phá bản cũ; rollback mã không drop schema hay dữ liệu đơn. Có thể ẩn các reference bằng admin/SQL, giữ đơn và catalog bán hiện có. Không rollback sang bản có lỗi cold product route mà không cân nhắc lỗi đã biết.
