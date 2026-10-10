# Commerce & SEO — 10/10/2026

Release evidence: main b3469ff, dpl_GDVp9TquQEFKJXZPdq7XFzwkwZ6C READY, verified production target and garden-dreams-florist.vercel.app alias. Stage 04a94ca/dpl_4uPTP9C3V1w3oEPUWQEct6rTMXUG READY. Guarded cover cleanup applied after assets deployed on both environments. Production still has one existing order and zero payment receipts. Local handler with the compiled template passed home/product/sitemap/404/HEAD/405 on synthetic public catalog; this does not prove hosted HTTP/browser behavior.

## Đã nối vào ứng dụng

- Tìm hoa không phân biệt dấu, dùng chung chuẩn hóa với lịch sử khách.
- URL ổn định `/hoa/bo-hoa-ID`; giữ slug khi admin đổi tên. Trang riêng dùng lại lựa chọn cỡ/số lượng và hành động đặt trực tiếp.
- Vercel Function dựng HTML từ catalog công khai đang bán: tên, giá, mô tả, liên kết sản phẩm có ngay trong response. Canonical, tiêu đề/mô tả theo sản phẩm, Florist/Product JSON-LD, robots và sitemap động. Không khai báo InStock khi chưa kiểm tồn; snapshot HTML cache 60 giây, đặt đơn vẫn định giá lại tại database. Preview noindex; dữ liệu tài khoản/đơn không đi vào HTML hoặc cache công khai.
- Giảm ba font từ 388.684 xuống 133.560 byte bằng WOFF2; đối chiếu cmap giữ nguyên ký tự. Bỏ video hero cũ 852 KB; cache media dài, cache ảnh 1 ngày để không giữ ảnh admin sửa quá lâu. JavaScript đầu trang vẫn khoảng 702 KB chưa nén (index + Store), chưa đo CWV.
- Xóa API orders luôn trả 503 và hai kiểm thử dành riêng cho endpoint bỏ đi. Đơn tiếp tục qua RPC có phiên/ownership, không mở một endpoint đặt công khai thiếu kiểm soát.
- Năm ảnh trùng 16–20 được thay bằng nhãn giữ chỗ riêng, ghi rõ ảnh thực tế đang cập nhật; không sinh ảnh giả rồi coi là bó đang bán. Album chủ shop upload được giữ; ảnh trong snapshot đơn cũ không đổi. Áp dụng catalog-photo-cleanup.sql sau deploy assets.

## Kho & công thức

Tab quản trị Kho & công thức có nguyên liệu STEM/UNIT, nhận lô/hạn/nhà cung cấp/giá vốn, recipe phiên bản theo cỡ, hao hụt và biến động. Khi bật: đơn mới giữ FEFO dưới transaction/lock; thiếu nguyên liệu rollback cả đơn và phần giữ; bắt đầu PREPARING trừ một lần; CANCELLED trả phần HELD. Công thức của allocation cũ không đổi khi tạo version mới. Lô hết hạn không dùng cho ngày giao; hao hụt không trừ phần đang giữ. Hủy sau khi đã dùng không tự biến hoa đã bó thành tồn mới.

Kho chỉ một shop, hai đơn vị nguyên; chưa conversion/branch/QC/đổi lô. Sổ biến động đọc 50 dòng gần nhất, lô đọc 200 dòng gần nhất; chưa báo cáo tồn toàn kho phân trang. Lock chung cố ý ưu tiên đúng tiền/tồn cho quy mô shop; chưa benchmark peak.

Production đã cài schema và có 20 slug. Kho mặc định tắt, không có lô/công thức giả; đơn cũ vẫn không bị giữ/trừ tồn. Chủ shop phải nhập dữ liệu thật rồi bật. Khi đang tắt, không được tuyên bố đang chặn overselling ngoài đời.

## Kiểm chứng và giới hạn phát hành

149 local tests và build qua, gồm giữ đơn cũ sau migration, quyền kho, FEFO, giá, retry, nhả/trừ/hao hụt, recipe snapshot và HTML escaping. Hosted staging stock rehearsal qua và rollback toàn bộ mẫu, đơn, lô, recipe, quyền admin tạm. Xác nhận staging còn zero order/stock/recipe, inventory off và mọi bảng Garden Dreams có RLS. Security advisors không có ERROR; còn cảnh báo RPC SECURITY DEFINER được kiểm quyền và leaked-password protection chưa bật.

Connector không cho bằng chứng hai transaction thử lock chồng thời gian (try-lock nhận true); chưa coi đây là test race hai đơn thật. Không có tải/race/ảnh hoặc browser acceptance giả.

Guest checkout frontend đã có và provider-gated; cần Anonymous Sign-Ins production. MCP không có Auth config API và dashboard tiếp tục bị saved browser permission block; không tự bỏ xác nhận email hay ownership để mở đặt nhanh. Đã yêu cầu chủ shop bật đúng cấu hình, không xin/ghi secret. SMTP/recovery hosted và banking-app scan vẫn chưa nghiệm thu.

TRACEABILITY đã cập nhật thành 40 chức năng một phần và 55 chưa triển khai, không chuyển thành 95 hoàn tất. Coupons, transactional notification worker, QC/xưởng, multi-branch, partial refund, loyalty và các NFR chưa được tuyên bố đã có. Vercel Hobby không phù hợp kinh doanh theo https://vercel.com/docs/plans/hobby ; chưa mua gói hoặc nối hosting thương mại khác.
