import BloomDate from './BloomDate.jsx';
import BloomSelect from './BloomSelect.jsx';
import { useState } from 'react';
import { useStore } from './Store.jsx';
import { money } from './catalog.js';
import { subtotal,validateOrder,vietnamDate } from './order.js';
import { Modal } from './ShopDialogs.jsx';
export function CheckoutDialog({ cart, onClose }) {
  const { products } = useStore();
  const [state, setState] = useState("form");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const busy = false;
  const [copyStatus, setCopyStatus] = useState("");
  async function copyOrder() {
    const summary = [
      "Garden Dreams — yêu cầu đặt hoa",
      ...receipt.items.map(
        (item) =>
          `${item.name}${item.sizeName ? ` · ${item.sizeName}` : ""} × ${item.quantity}: ${money(item.price * item.quantity)}`,
      ),
      `Tạm tính: ${money(receipt.subtotal)} (chưa gồm phí giao)`,
      `Người nhận: ${receipt.name}`,
      `Điện thoại: ${receipt.phone}`,
      `Địa chỉ: ${receipt.address}`,
      `Ngày nhận: ${receipt.deliveryDate} — ${receipt.deliveryTime}`,
      `Lời nhắn: ${receipt.message || "(không có)"}`,
      "Nhờ cửa hàng xác nhận hoa, giá và phí giao trước khi thực hiện.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("Đã sao chép. Bạn có thể dán nội dung khi mở Zalo.");
    } catch {
      setCopyStatus(
        "Trình duyệt không cho phép sao chép. Bạn có thể liên hệ cửa hàng qua số 0832 345 780.",
      );
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    let order;
    try {
      order = validateOrder(
        {
          ...fields,
          requestId,
          items: cart,
          consent: fields.consent === "on",
        },
        new Date(),
        products,
      );
    } catch (err) {
      setError(err.message);
      return;
    }
    setReceipt(order);
    setState("preview");
  }
  return (
    <Modal
      title="Chuẩn bị đơn hoa"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="checkout-dialog"
    >
      {state === "form" ? (
        <>
          <span className="eyebrow">Một chút chăm chút cuối cùng</span>
          <h2>
            Gửi hoa, <em>gửi thương.</em>
          </h2>
          {
            <p className="demo-note">
              Bản trải nghiệm · bạn có thể xem trước đơn hoa. Thông tin chưa
              được gửi đến cửa hàng.
            </p>
          }
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <label>
                  Tên người nhận
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={receipt?.name}
                    placeholder="Người bạn muốn gửi hoa"
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    name="phone"
                    autoComplete="tel"
                    type="tel"
                    required
                    maxLength={20}
                    defaultValue={receipt?.phone}
                    placeholder="09xx xxx xxx"
                  />
                </label>
              </div>
              <label>
                Địa chỉ nhận hoa
                <textarea
                  name="address"
                  autoComplete="street-address"
                  required
                  minLength={10}
                  maxLength={300}
                  defaultValue={receipt?.address}
                  rows={2}
                  placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
                />
              </label>
              <div className="form-grid">
                <label>
                  Ngày mong muốn
                  <BloomDate
                    name="deliveryDate"

                    min={vietnamDate()}
                    max={vietnamDate(new Date(Date.now() + 90 * 86400000))}
                    defaultValue={receipt?.deliveryDate}
                    required
                  />
                </label>
                <label>
                  Khung giờ
                  <BloomSelect
                    name="deliveryTime"
                    required
                    defaultValue={receipt?.deliveryTime || "Chiều · 13–17h"}
                  >
                    <option>Sáng · 9–12h</option>
                    <option>Chiều · 13–17h</option>
                    <option>Tối · 18–20h</option>
                  </BloomSelect>
                </label>
              </div>
              <label>
                Lời nhắn trên thiệp{" "}
                <span className="optional">(không bắt buộc)</span>
                <textarea
                  name="message"
                  rows={3}
                  maxLength={500}
                  defaultValue={receipt?.message}
                  placeholder="Có những lời, để hoa nói giúp…"
                />
              </label>
              <label className="honeypot" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <div className="checkout-summary">
                {cart.map((line) => (
                  <p key={cartKey(line)}>
                    <span>
                      {products.find((p) => p.id === line.id).name} ×{" "}
                      {line.quantity}
                      {cartChoice(line, products)?.sizeName && ` · ${cartChoice(line, products).sizeName}`}
                    </span>
                    <span>
                      {money(
                        cartChoice(line, products).price *
                          line.quantity,
                      )}
                    </span>
                  </p>
                ))}
                <div className="cart-total">
                  <span>Tạm tính</span>
                  <strong>{money(subtotal(cart, products))}</strong>
                </div>
                <small>Thanh toán khi nhận · phí giao xác nhận sau</small>
              </div>
              <label className="consent">
                <input
                  name="consent"
                  type="checkbox"
                  defaultChecked={Boolean(receipt)}
                  required
                />{" "}
                <span>
                  Tôi đồng ý để cửa hàng dùng thông tin trên nhằm liên hệ và xử
                  lý yêu cầu đặt hoa.
                </span>
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary checkout-button" type="submit">
                Xem trước đơn hoa
                <Icon name="arrow" />
              </button>
              <p className="fineprint">
                Yêu cầu chỉ trở thành đơn giao hoa sau khi cửa hàng xác nhận
                tình trạng hoa, giá và phí giao.
              </p>
            </fieldset>
          </form>
        </>
      ) : (
        <div className="receipt">
          <span className="receipt-icon">
            <Icon name={state === "preview" ? "flower" : "check"} />
          </span>
          <span className="eyebrow">
            {state === "preview" ? "Yêu cầu mẫu · chưa gửi" : "Đã lưu yêu cầu"}
          </span>
          <h2>
            {state === "preview" ? (
              <>
                Món quà <em>đã sẵn sàng.</em>
              </>
            ) : (
              <>
                Lời thương <em>đã đến.</em>
              </>
            )}
          </h2>
          <p>
            {state === "preview"
              ? "Đây là bản xem trước. Cửa hàng chưa nhận đơn và chưa thu tiền; giỏ hoa của bạn vẫn được giữ."
              : "Cửa hàng đã nhận yêu cầu và sẽ liên hệ để xác nhận. Bạn chưa bị thu tiền."}
          </p>
          {receipt.reference && (
            <p className="order-reference">{receipt.reference}</p>
          )}
          <div className="receipt-details">
            <p>
              <span>Người nhận</span>
              <strong>{receipt.name}</strong>
            </p>
            <p>
              <span>Ngày nhận</span>
              <strong>
                {new Intl.DateTimeFormat("vi-VN").format(
                  new Date(`${receipt.deliveryDate}T12:00:00+07:00`),
                )}
              </strong>
            </p>
            <p>
              <span>Tạm tính</span>
              <strong>{money(receipt.subtotal)}</strong>
            </p>
          </div>
          <div className="receipt-contact">
            <button className="button outline" onClick={copyOrder}>
              Sao chép nội dung
            </button>
            <a
              className="text-link"
              href="https://zalo.me/0832345780"
              target="_blank"
              rel="noreferrer"
            >
              Mở Zalo cửa hàng <Icon name="arrow" />
            </a>
            <p className="fineprint" role="status">
              {copyStatus ||
                "Sao chép nội dung và tự gửi qua Zalo khi muốn trao đổi. Website chưa tự gửi tin nhắn."}
            </p>
          </div>
          {state === "preview" && (
            <button className="text-button" onClick={() => setState("form")}>
              Chỉnh lại thông tin
            </button>
          )}
          <button className="button primary" onClick={onClose}>
            Tiếp tục khám phá <Icon name="arrow" />
          </button>
        </div>
      )}
    </Modal>
  );
}
