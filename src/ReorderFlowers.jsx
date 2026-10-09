import { useState } from "react";
import { useStore } from "./Store.jsx";
import { money } from "./catalog.js";
import { cartKey, normalizeCart } from "./order.js";
import { prepareReorder, reorderReasons } from "./reorder.js";
import "./reorder.css";

export default function ReorderFlowers({ order, cart = [], onReorder }) {
  const { products, connected, loading, error, shop } = useStore();
  const [actionError, setActionError] = useState("");
  const preview = prepareReorder(order.items, cart, products);
  const catalogReady = connected && !loading && !error;
  const enabled = catalogReady && typeof onReorder === "function" && preview.addedQuantity > 0;
  const limited = preview.lines.some(line => line.reason);
  const partiallyAvailable = preview.unavailable.length > 0 || limited;
  return (
    <section className="reorder-flowers" aria-labelledby={`reorder-heading-${order.id}`}>
      <div className="reorder-heading"><span className="eyebrow">THÊM MỘT LẦN GỬI THƯƠNG</span><h3 id={`reorder-heading-${order.id}`}>Chọn lại những bó hoa này</h3><p>Chọn lại mẫu và cỡ theo bộ sưu tập hiện tại. Giá, phí giao và lịch nhận của đơn cũ không được dùng cho lần đặt mới.</p></div>
      {!catalogReady && <p className="reorder-notice" role={error ? "alert" : "status"}>{loading ? "Đang cập nhật bộ sưu tập. Chờ tải xong trước khi thêm hoa." : error ? "Chưa xác nhận được bộ sưu tập hiện tại. Tải lại trang khi kết nối ổn định; chưa thể thêm hoa." : "Chưa kết nối được cửa hàng. Chưa thể kiểm tra mẫu và giá hiện tại."}</p>}
      {catalogReady && <>
        {!!preview.lines.length && <ul className="reorder-lines">{preview.lines.map(line => <li key={cartKey(line)}>
          {line.image && <img src={line.image} alt="" loading="lazy" width="64" height="80" />}
          <div><strong>{line.name}</strong><p>{line.sizeName ? `Cỡ ${line.sizeName}` : "Cỡ tiêu chuẩn"}{line.sku ? ` · ${line.sku}` : ""}</p><p>Giá hiện tại {money(line.price)} / bó</p><p>Đơn cũ: {line.quantity} bó{line.existingQuantity ? ` · Giỏ hiện tại: ${line.existingQuantity} bó` : ""}</p>{line.reason && <p className="reorder-line-warning">{reorderReasons[line.reason]}</p>}</div>
          <div className="reorder-line-amount"><span>{line.addedQuantity ? `Thêm ${line.addedQuantity} bó` : "Chưa thêm được"}</span><strong>{money(line.subtotal)}</strong></div>
        </li>)}</ul>}
        {!!preview.unavailable.length && <div className="reorder-unavailable"><h4>Những lựa chọn chưa thể thêm</h4><ul>{preview.unavailable.map((line, index) => <li key={index}><strong>{line.name}{line.sizeName ? ` · ${line.sizeName}` : ""}</strong><p>{reorderReasons[line.reason]}</p></li>)}</ul><p>Bạn có thể chọn mẫu hoặc cỡ khác trong bộ sưu tập. Cửa hàng không tự thay hoa trong đơn cũ.</p><a className="text-link" href="#collection">Xem các mẫu hoa hiện tại →</a></div>}
        {partiallyAvailable && preview.addedQuantity > 0 && <p className="reorder-notice">Chỉ {preview.addedQuantity} bó được thêm ở lần này. Những mẫu chưa có hoặc phần vượt giới hạn được giữ ngoài giỏ; kiểm tra danh sách trước khi tiếp tục.</p>}
        {!preview.lines.length && !preview.unavailable.length && <p className="reorder-notice">Đơn cũ chưa có mẫu hoa để chọn lại. Bạn có thể bắt đầu từ bộ sưu tập hiện tại.</p>}
        <div className="reorder-summary"><div><span>Tiền hoa thêm vào giỏ</span><strong>{money(preview.total)}</strong><small>{preview.addedQuantity} bó · Chưa gồm phí giao; chưa tạo đơn hoặc thu tiền.</small></div><button type="button" className="button outline" disabled={!enabled} onClick={() => {
          if (!enabled) return;
          setActionError("");
          try {
            const requested = normalizeCart(preview.lines.filter(line => line.addedQuantity > 0).map(line => ({ id: line.id, ...(line.variantId == null ? {} : { variantId: line.variantId }), quantity: line.quantity })), products);
            onReorder(requested);
          } catch { setActionError("Chưa thêm được vào giỏ. Giỏ hiện tại vẫn được giữ; thử lại trước khi đặt hoa."); }
        }}>{partiallyAvailable ? "Thêm phần còn chọn được & mở giỏ" : "Thêm hoa & mở giỏ"}</button></div>
        {typeof onReorder !== "function" && <p className="reorder-notice">Chưa thể mở giỏ từ lịch sử trong phiên này. Bạn vẫn có thể chọn hoa tại bộ sưu tập.</p>}
        {!shop.accepting_orders && <p className="reorder-quiet">Cửa hàng hiện chưa mở nhận đơn. Bạn có thể chuẩn bị giỏ; chỉ đặt được khi cửa hàng mở lại.</p>}
      </>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
    </section>
  );
}
