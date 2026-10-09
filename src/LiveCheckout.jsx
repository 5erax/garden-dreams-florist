import { useEffect, useState } from "react";
import { useStore } from "./Store.jsx";
import { call } from "./backend.js";
import { money } from "./catalog.js";
import { subtotal, validateOrder, vietnamDate, cartChoice, cartKey } from "./order.js";
import { Modal } from "./ShopDialogs.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import { BankPayment } from "./OrderDetail.jsx";
import { sendCheckout } from "./checkout-request.js";
import { shopAddress } from "./shop-contact.js";

export default function LiveCheckout({ cart, pending, onClose, onComplete }) {
  const {
    shop,
    products,
    shipping,
    session,
    error: storeError,
    loading,
    refresh,
  } = useStore();
  const [draft] = useState(() => pending.current && pending.current.ownerId === session?.user.id ? pending.current.request : null);
  const [shippingId, setShippingId] = useState(draft?.shippingId || shipping[0]?.id || ""),
    [payment, setPayment] = useState(draft?.paymentMethod || (shop.cod_enabled ? "COD" : "VIETQR"));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null);
  const [requestId] = useState(() => draft?.requestId || crypto.randomUUID());
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
    await sendRequest({
      ...raw,
      requestId,
      items: cart.map(({ id, quantity, variantId }) => ({ id, quantity, ...(variantId == null ? {} : { variantId }) })),
      consent: raw.consent === "on",
      shippingId,
      paymentMethod: payment,
      expectedTotal: total,
    });
  }
  async function sendRequest(request) {
    if (busy || !session) return;
    setError("");
    setBusy(true);
    try {
      const { order, request: submitted } = await sendCheckout(pending, session.user.id, request,
        payload => call("gd_create_order", { p_request: payload }));
      setReceipt(order);
      onComplete(submitted);
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
      {!loading && !storeError && !shop.accepting_orders && !receipt && !pending.current ? (
        <div className="receipt">
          <span className="eyebrow">LIÊN HỆ GARDEN DREAMS</span>
          <h2>Bó hoa bạn chọn,<br /><em>cửa hàng sẽ tư vấn.</em></h2>
          <p>Đặt hoa trực tuyến đang được chuẩn bị. Liên hệ cửa hàng để trao đổi về bó hoa và ngày giao; chưa có đơn nào được gửi từ bước này.</p>
          <address>{shop.address || shopAddress}</address>
          <p>{shipping.length
            ? shipping.map(service => `${service.name}: ${money(service.fee)}`).join(" · ")
            : "Miễn phí giao trong Long Thành. Ngoài khu vực: 30.000đ; khu vực xa hơn: 50.000đ."} Shop xác nhận địa chỉ và mức phí trước khi nhận giao.</p>
          <a className="button primary" href={`tel:${shop.phone}`}>Gọi {shop.phone}</a>
          <a className="button outline" href={`https://zalo.me/${shop.phone}`} target="_blank" rel="noreferrer">Trao đổi qua Zalo</a>
        </div>
      ) : !session ? (
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
          {pending.current?.ownerId === session.user.id && (
            <div className="portal-notice" role="status">
              <h3>Kiểm tra yêu cầu vừa gửi</h3>
              <p>Chưa nhận được xác nhận. Thử lại sẽ dùng đúng yêu cầu cũ để tránh tạo hai đơn, kể cả khi bạn đã đóng bước thanh toán hoặc sửa giỏ hoa.</p>
              <p>Tổng đã gửi: <strong>{money(pending.current.request.expectedTotal)}</strong></p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button primary" disabled={busy} onClick={() => sendRequest(pending.current.request)}>
                {busy ? "Đang kiểm tra…" : "Thử lại yêu cầu vừa gửi"}
              </button>
              <a className="text-link" href="#account" onClick={onClose}>Kiểm tra lịch sử mua</a>
            </div>
          )}
          <form onSubmit={submit} hidden={pending.current?.ownerId === session.user.id}>
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
                    defaultValue={draft?.name || ""}
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
                    defaultValue={draft?.phone || ""}
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
                  defaultValue={draft?.address || ""}
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
                    defaultValue={draft?.deliveryDate || ""}
                    type="date"
                    min={vietnamDate()}
                    max={vietnamDate(new Date(Date.now() + 90 * 86400000))}
                    required
                  />
                </label>
                <label>
                  Khung giờ
                  <select name="deliveryTime" defaultValue={draft?.deliveryTime || "Chiều · 13–17h"}>
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
                  defaultValue={draft?.message || ""}
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
                <input name="consent" type="checkbox" defaultChecked={draft?.consent || false} required />
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
          {error && !pending.current && (
            <button className="button outline" disabled={busy || loading} onClick={async () => {
              await refresh();
              setError("");
            }}>Cập nhật giá & dịch vụ giao</button>
          )}
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
