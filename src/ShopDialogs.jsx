
import BloomSelect from "./BloomSelect.jsx";
import { Fragment, useEffect, useRef, useState } from "react";
import { money } from "./catalog.js";
import { subtotal, cartChoice, cartKey } from "./order.js";
import Icon from "./Icons.jsx";
import { useStore } from "./Store.jsx";
import ProductGallery from "./ProductGallery.jsx";
import { productUrl, productTitle } from './product-url.js';
import { deliveryCopy } from './delivery-copy.js';
import { bouquetSpecification } from './bouquet-specification.js';

export function Modal({ title, children, onClose, className = "" }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.dataset.motion = previous?.matches?.(":focus-visible") ? "none" : "enter";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={className}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-content">
        <button
          className="icon-button dialog-close"
          aria-label="Đóng"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </dialog>
  );
}

export function ProductDialog({
  product,
  onClose,
  onAdd,
  onBuy,
  favorite,
  onFavorite,
  inline = false,
  shipping = [],
  readOnly = false,
  initialVariantId = null,
}) {
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(initialVariantId);
  const [shareNotice, setShareNotice] = useState('');
  const choice = cartChoice({ id: product.id, variantId }, [product]);
  const Wrapper = inline ? 'section' : Modal;
  const Body = inline ? Fragment : 'div';
  const Heading = inline ? 'h1' : 'h2';
  return (
    <Wrapper {...(inline ? { className: 'product-page' } : { title: product.name, onClose, className: 'product-dialog' })}>
      <Body {...(inline ? {} : { className: 'product-detail-body' })}>
      <ProductGallery key={product.id} product={product} />
      <div className="product-detail-copy">
        <span className="eyebrow">
          Một món quà cho {(product.occasion || "người bạn thương").toLocaleLowerCase("vi")}
        </span>
        <Heading>{productTitle(product)}</Heading>
        {choice && <p className="detail-price">{money(choice.price)} <span>/ bó</span></p>}
        {(product.variants?.length > 0 || variantId !== null) && <label className="variant-choice">
          Cỡ bó hoa
          <BloomSelect name="variantId" aria-invalid={!choice} value={variantId ?? ""} onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : null)}>
            {!choice && variantId !== null && <option value={variantId} disabled>Cỡ đã ngừng nhận đặt</option>}
            <option value="">Tiêu chuẩn · {money(product.price)}</option>
            {product.variants?.map(v => <option key={v.id} value={v.id}>{v.size_name} · {money(v.price)}</option>)}
          </BloomSelect>
        </label>}
        {product.reference_only ? <p className="reference-note">Mẫu tham khảo · Giá dự kiến {money(product.price)}. Shop đang xác nhận nguồn hoa, quy cách và giá bán trước khi nhận đặt mẫu này.</p> : !choice && <p className="form-error" role="alert">Mẫu hoặc cỡ này chưa đủ điều kiện nhận đặt; shop cần ảnh thực tế trước khi bán.</p>}
        <p>{product.description}</p>
        <dl>
          <dt>Trong bó hoa</dt>
          <dd>{product.stems?.replace(/hoa phụ/gi, 'hoa nhỏ phối cùng')}</dd>
          <dt>Quy cách{choice?.sizeName ? ` · ${choice.sizeName}` : ''}</dt><dd aria-live="polite">{bouquetSpecification(product,variantId)}</dd>
          <dt>Lời nhắn</dt>
          <dd>Thêm lời nhắn của bạn khi đặt hoa</dd>
        </dl>
        <p className="fineprint">
          Hoa được chọn theo mùa. Nếu cần thay hoa hoặc màu sắc, shop sẽ trao đổi trước khi thực hiện.
        </p>
        <p className="product-delivery">{deliveryCopy(shipping)}. Chọn địa chỉ và ca giao ở bước đặt hoa để kiểm tra phí và lịch còn nhận.</p>
        {!readOnly && <button
          className="text-button favorite-detail"
          onClick={onFavorite}
          aria-pressed={favorite}
        >
          <Icon name="heart" />
          {favorite ? "Đã lưu vào yêu thích" : "Lưu bó hoa này"}
        </button>}
        <div className="product-share">
          <button className="text-button" onClick={async () => {
            try { await navigator.clipboard.writeText(new URL(productUrl(product), location.origin).href); setShareNotice('Đã sao chép liên kết bó hoa.'); }
            catch { setShareNotice('Chưa sao chép được. Thử lại hoặc dùng chức năng chia sẻ của trình duyệt.'); }
          }}>Sao chép liên kết bó hoa</button>
          {shareNotice && <p role="status">{shareNotice}</p>}
        </div>
        <p className="product-care">Giữ hoa nơi mát, tránh nắng trực tiếp; thay nước và cắt gốc thường xuyên nếu cắm bình.</p>
      </div>
      </Body>
      {!readOnly && <div className="product-purchase-footer">
        {choice && <div className="detail-summary" aria-live="polite" aria-atomic="true">
          <span>Tạm tính</span>
          <strong>{money(subtotal([{ id: product.id, quantity, variantId }], [product]))}</strong>
          <span>{quantity} bó · {choice.sizeName || "Tiêu chuẩn"}</span>
          <small>Chưa gồm phí giao hoa</small>
        </div>}
        {choice ? <div className="detail-actions" id={inline ? "buy" : undefined}>
          <Quantity
            value={quantity}
            onChange={setQuantity}
            name={product.name}
          />
          <button
            className="button outline"
            disabled={!choice}
            onClick={() => {
              onAdd(product.id, quantity, variantId);
              onClose?.();
            }}
          >
            Thêm vào giỏ hoa <Icon name="bag" />
          </button>
          <button className="button primary" disabled={!choice} onClick={() => onBuy(product.id, quantity, variantId)}>
            Đặt ngay <Icon name="arrow" />
          </button>
        </div> : <div className="unavailable-actions"><p>Tìm một bó hoa sẵn sàng cho ngày bạn muốn gửi.</p><a className="button primary" href="/#collection">Xem hoa đang nhận đặt <Icon name="arrow" /></a></div>}
      </div>}
    </Wrapper>
  );
}

function Quantity({ value, onChange, name }) {
  return (
    <div className="quantity">
      <button
        aria-label={`Giảm số lượng ${name}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        aria-label={`Tăng số lượng ${name}`}
        disabled={value >= 20}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function CartDialog({ cart, onClose, onChange, onCheckout, onView, focusKey }) {
  const { products } = useStore();
  const [removed, setRemoved] = useState(null);
  const [undoNotice, setUndoNotice] = useState('');
  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => document.getElementById(`cart-view-${focusKey}`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Modal title="Giỏ hoa của bạn" onClose={onClose} className="cart-dialog">
      <span className="eyebrow">Dành cho người bạn thương</span>
      <h2>
        Giỏ hoa <em>của bạn.</em>
      </h2>
      <p className="muted">{count} bó hoa · một lời thương đang chờ gửi</p>
      {removed && <div className="cart-undo" role="status"><span>Đã bỏ {products.find(p=>p.id===removed.id)?.name} khỏi giỏ.</span><button className="text-button" onClick={() => {
        const existing = cart.find(line=>cartKey(line)===cartKey(removed));
        if (!cartChoice(removed, products)) { setUndoNotice('Mẫu này hiện chưa nhận đặt. Chọn một bó hoa khác.'); return; }
        if (!existing && cart.length >= 20) { setUndoNotice('Giỏ đã đủ 20 mẫu. Bỏ một mẫu trước khi hoàn tác.'); return; }
        onChange(removed.id, Math.max(existing?.quantity || 0, removed.quantity), removed.variantId); setRemoved(null);setUndoNotice('Đã khôi phục bó hoa.');
      }}>Hoàn tác</button></div>}
      {undoNotice && <p role="status">{undoNotice}</p>}
      {!cart.length ? (
        <div className="empty-state">
          <Icon name="bag" />
          <h3>Một giỏ hoa đang chờ bạn</h3>
          <p>Chọn một bó hoa để bắt đầu món quà của mình.</p>
          <button className="button primary" onClick={onClose}>
            Tiếp tục chọn hoa <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <>
          <div className="cart-lines">
            {cart.map((line) => {
              const product = cartChoice(line, products);
              return (
                <article className="cart-line" key={cartKey(line)}>
                  <img src={product.image} alt={product.name} />
                  <div>
                    <span className="eyebrow">{product.occasion}</span>
                  <h3><button id={`cart-view-${cartKey(line)}`} className="text-button cart-product-link" onClick={() => onView?.(products.find(p=>p.id===line.id), line)}>{product.name}</button></h3>
                    {product.sizeName && <p>Cỡ {product.sizeName}</p>}
                    <p>{money(product.price)}</p>
                    <Quantity
                      value={line.quantity}
                      onChange={(quantity) => onChange(line.id, quantity, line.variantId)}
                      name={`${product.name}${product.sizeName ? ` · ${product.sizeName}` : ""}`}
                    />
                  </div>
                  <button
                    className="text-button remove"
                    onClick={() => { setRemoved({...line}); setUndoNotice(''); onChange(line.id, 0, line.variantId); }}
                    aria-label={`Xóa ${product.name}${product.sizeName ? ` · ${product.sizeName}` : ""}`}
                  >
                    Xóa
                  </button>
                </article>
              );
            })}
          </div>
          <div className="cart-total">
            <span>Tạm tính</span>
            <strong>{money(subtotal(cart, products))}</strong>
          </div>
          <p className="fineprint">
            Chọn ngày và khu vực giao ở bước tiếp theo. Tổng tiền được hiển thị trước khi đặt.
          </p>
          <button
            className="button primary checkout-button"
            onClick={onCheckout}
          >
            Chọn ngày & đặt hoa <Icon name="arrow" />
          </button>
          <button className="text-button continue-shopping" onClick={onClose}>
            Tiếp tục chọn hoa
          </button>
        </>
      )}
    </Modal>
  );
}
