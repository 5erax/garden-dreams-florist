import { useEffect, useState } from "react";
import { useStore } from "./Store.jsx";
import { call } from "./backend.js";
import { money } from "./catalog.js";
import { subtotal, validateOrder, vietnamDate, cartChoice, cartKey } from "./order.js";
import { Modal } from "./ShopDialogs.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import { BankPayment } from "./OrderDetail.jsx";

export default function LiveCheckout({ cart, onClose, onComplete }) {
  const {
    shop,
    products,
    shipping,
    session,
    error: storeError,
    loading,
  } = useStore();
  const [shippingId, setShippingId] = useState(shipping[0]?.id || ""),
    [payment, setPayment] = useState(shop.cod_enabled ? "COD" : "VIETQR");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null);
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!shipping.some((s) => s.id === shippingId))
      setShippingId(shipping[0]?.id || "");
  }, [shipping, shippingId]);
  useEffect(() => {
    if (payment === "COD" && !shop.cod_enabled && shop.transfer_enabled)
      setPayment("VIETQR");
    if (payment === "VIETQR" && !shop.transfer_enabled && shop.cod_enabled)
      setPayment("COD");
  }, [shop.cod_enabled, shop.transfer_enabled, payment]);
  const service = shipping.find((s) => s.id === shippingId),
    total = subtotal(cart, products) + (service?.fee || 0);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    try {
      validateOrder(
        { ...raw, requestId, items: cart, consent: raw.consent === "on" },
        new Date(),
        products,
      );
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy(true);
    try {
      const order = await call("gd_create_order", {
        p_request: {
          ...raw,
          requestId,
          items: cart.map(({ id, quantity, variantId }) => ({ id, quantity, ...(variantId == null ? {} : { variantId }) })),
          consent: raw.consent === "on",
          shippingId,
          paymentMethod: payment,
          expectedTotal: total,
        },
      });
      setReceipt(order);
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Đặt hoa & giao nhận"
      className="checkout-dialog live-checkout"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!session ? (
        <AuthPanel />
      ) : receipt ? (
        <div className="receipt">
          <span className="eyebrow">ĐÃ LƯU VÀO LỊCH SỬ CỦA BẠN</span>
          <h2>
            Lời thương
            <br />
            <em>đã được giữ.</em>
          </h2>
          <p>
            Yêu cầu {receipt.reference} đã được lưu. Cửa hàng sẽ kiểm tra hoa và
            khu vực giao trước khi xác nhận.
          </p>
          <strong>{money(receipt.total)}</strong>
          <BankPayment order={receipt} />
          <p>
            Bạn có thể theo dõi tiến trình và xem lại lời nhắn trong Góc của
            tôi.
          </p>
          <a className="button primary" href="#account" onClick={onClose}>
            Xem lịch sử mua
          </a>
        </div>
      ) : (
        <>
          <span className="eyebrow">MỘT CHÚT CHĂM CHÚT CUỐI CÙNG</span>
          <h2>
            Gửi hoa,
            <br />
            <em>gửi thương.</em>
          </h2>
          {!shop.accepting_orders && (
            <p className="demo-note">
              Cửa hàng chưa mở nhận đơn thật. Bạn có thể tiếp tục xem hoa; thông
              tin chưa được gửi.
            </p>
          )}
          {storeError && (
            <p className="form-error" role="alert">
              {storeError}
            </p>
          )}
          <form onSubmit={submit}>
            <fieldset
              disabled={
                busy ||
                loading ||
                Boolean(storeError) ||
                !shop.accepting_orders ||
                !shipping.length
              }
            >
              <div className="form-grid">
                <label>
                  Tên người nhận
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    name="phone"
                    type="tel"
                    required
                    maxLength={20}
                    autoComplete="tel"
                  />
                </label>
              </div>
              <label>
                Địa chỉ nhận hoa
                <textarea
                  name="address"
                  required
                  minLength={10}
                  maxLength={300}
                  autoComplete="street-address"
                  rows={2}
                />
              </label>
              <div className="form-grid">
                <label>
                  Ngày mong muốn
                  <input
                    name="deliveryDate"
                    type="date"
                    min={vietnamDate()}
                    max={vietnamDate(new Date(Date.now() + 90 * 86400000))}
                    required
                  />
                </label>
                <label>
                  Khung giờ
                  <select name="deliveryTime" defaultValue="Chiều · 13–17h">
                    <option>Sáng · 9–12h</option>
                    <option>Chiều · 13–17h</option>
                    <option>Tối · 18–20h</option>
                  </select>
                </label>
              </div>
              <label>
                Lời nhắn trên thiệp (giữ riêng)
                <textarea
                  name="message"
                  maxLength={500}
                  rows={3}
                  placeholder="Lời thương bạn muốn gửi…"
                />
              </label>
              <p className="fineprint">
                Sau khi đơn hoàn tất và đã thanh toán, bạn có thể chủ động chia
                sẻ chính lời nhắn này. Cửa hàng không tự công khai.
              </p>
              <label>
                Dịch vụ giao hoa
                <select
                  value={shippingId}
                  onChange={(e) => setShippingId(e.target.value)}
                  required
                >
                  {shipping.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {money(s.fee)}
                    </option>
                  ))}
                </select>
              </label>
              {service && <p className="fineprint">Áp dụng: {service.area}</p>}
              <label>
                Phương thức thanh toán
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  {shop.cod_enabled && (
                    <option value="COD">COD — thanh toán khi nhận</option>
                  )}
                  {shop.transfer_enabled && (
                    <option value="VIETQR">Chuyển khoản VietQR</option>
                  )}
                </select>
              </label>
              <div className="checkout-summary">
                {cart.map((line) => (
                  <p key={cartKey(line)}>
                    <span>
                      {products.find((p) => p.id === line.id)?.name} ×{" "}
                      {line.quantity}
                      {cartChoice(line, products)?.sizeName && ` · ${cartChoice(line, products).sizeName}`}
                    </span>
                    <span>
                      {money(
                        (cartChoice(line, products)?.price || 0) *
                          line.quantity,
                      )}
                    </span>
                  </p>
                ))}
                <p>
                  <span>Phí giao</span>
                  <span>{money(service?.fee || 0)}</span>
                </p>
                <div className="cart-total">
                  <span>Tổng cộng</span>
                  <strong>{money(total)}</strong>
                </div>
              </div>
              <label className="consent">
                <input name="consent" type="checkbox" required />
                <span>
                  Tôi đồng ý cho cửa hàng dùng thông tin để xử lý và giao đơn
                  hoa.
                </span>
              </label>
              <label className="honeypot" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" type="submit">
                {busy ? "Đang lưu yêu cầu…" : "Gửi yêu cầu đặt hoa"}
              </button>
              <p className="fineprint">
                Chuyển khoản chưa được tự xác nhận. Giỏ hàng chỉ xóa sau khi
                database lưu đơn thành công.
              </p>
            </fieldset>
          </form>
          {!shipping.length && (
            <p className="portal-notice">
              Cửa hàng đang cấu hình dịch vụ giao hoa.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
