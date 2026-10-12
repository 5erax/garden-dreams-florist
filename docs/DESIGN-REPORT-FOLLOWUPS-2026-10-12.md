# Design report follow-ups

Design contract: retain the cream/pink identity, initial transparent navigation and falling petals. Fix mobile order access, modal scrolling, long-form saving and collection density without changing commerce rules or production records.

| Finding | Resolution |
| --- | --- |
| Catalog photo gaps | Five Vietnamese shop sources are linked in the corresponding pending product editor. They are research references, not Garden Dreams photos. No unlicensed copies, invented stem counts or automatic sale activation. Real shop photos and confirmed recipes remain owner work. |
| Mobile orders | Below 768px each order becomes a labeled card with a visible status and full-width detail button; desktop retains the table. |
| Product dialog | Gallery and description share one scrolling body; purchase controls remain outside it. Inline product pages and read-only admin previews retain their behavior. |
| Long product editor | Information and image groups, sticky save/cancel controls, field scroll offsets and one error alert in the save bar. Failed saves preserve input. |
| Collection density | Compact mobile intro/controls, remove duplicate anchor offset and unnecessary spacing. First image begins around 677px at 320/390 × 844 in the local fixture. |

## Photo research

- Đồng hoa — [Hoa Yêu Thương, Garden style 05](https://hoayeuthuong.com/hoa-tuoi/hoa-cuc/10675_garden-style-05), mixed chrysanthemums.
- Bình yên — [SHIN Flowers, S007](https://shinflowers.com/product/hoa-bo-cam-tu-cau-xanh-s007/), blue hydrangeas with white orchids.
- Ngày rực rỡ — [FlowerSight, Warm Soul](https://flowersight.com/bo-hoa-dong-tien-vang/), yellow gerberas with Tana chrysanthemums.
- Tinh khôi — [Dalat Hasfarm, white lily](https://dalathasfarm.com/a5/hoa-lily-don-mau-trang-4f-p3150.html), cut stems rather than a finished wrapped bouquet.
- Ôm dịu dàng — [Hoa Yêu Thương, Thương yêu nhẹ nhàng](https://hoayeuthuong.com/cua-hang-hoa/hoa-khuyen-mai/16573_thuong-yeu-nhe-nhang), pink roses with Tana; not an exact match for eucalyptus.

Sources reviewed 2026-10-12. Their prices, dimensions, stem counts and photographs are not asserted as Garden Dreams product facts. Upload authorized, confirmed images through the existing album editor.

## Validation

- 204 automated tests pass, including preserved edit values, one visible error alert and source links disappearing when own photos replace the placeholder.
- Production build passes the public catalog, 40 product pages, sitemap and JSON-LD contracts.
- Browser checks use read-only synthetic admin data; no real customer orders or payments are written.
- No new dependency, database migration or production data mutation.
