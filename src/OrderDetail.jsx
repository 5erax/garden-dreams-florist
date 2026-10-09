import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  backend,
  call,
  result,
  orderStatuses,
  paymentStatuses,
} from "./backend.js";
import { money } from "./catalog.js";
import { vietqrPayload } from "./vietqr.js";

export function BankPayment({ order }) {
  const [qr, setQr] = useState(""),
    [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => {
    let active = true;
    setQr("");
    setError("");
    if (
      order.payment_method !== "VIETQR" ||
      order.payment_status !== "UNPAID" ||
      order.status === "CANCELLED"
    )
      return;
    try {
      QRCode.toDataURL(
        vietqrPayload(order.bank, Number(order.total), order.reference),
        { width: 240, margin: 2, errorCorrectionLevel: "M" },
      )
        .then((src) => {
          if (active) setQr(src);
        })
        .catch(() => {
          if (active)
            setError("Chưa tạo được QR. Dùng thông tin chuyển khoản bên dưới.");
        });
    } catch {
      setError("Thông tin QR chưa hợp lệ. Liên hệ shop để xác nhận.");
    }
    return () => {
      active = false;
    };
  }, [order]);
  if (
    order.payment_method !== "VIETQR" ||
    order.payment_status !== "UNPAID" ||
    order.status === "CANCELLED"
  )
    return null;
  return (
    <aside className="bank-payment">
      <div>
        {qr && (
          <img
            src={qr}
            alt={`VietQR cho đơn ${order.reference}`}
            width="240"
            height="240"
          />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <div>
        <span className="eyebrow">CHUYỂN KHOẢN VIETQR</span>
        <h3>{money(order.total)}</h3>
        <p>
          {order.bank.bankName}
          <br />
          <strong>{order.bank.accountName}</strong>
          <br />
          {order.bank.account}
        </p>
        <p>
          Nội dung: <strong>{order.reference}</strong>
        </p>
        <div className="payment-tools">
          {[['Sao chép số tài khoản', order.bank.account], ['Sao chép nội dung', order.reference]].map(([label, value]) => <button type="button" className="button outline" key={label} onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopyNotice(`${label}: đã chép.`); }
            catch { setCopyNotice("Chưa sao chép được. Bạn có thể chọn thông tin ở trên để chép thủ công."); }
          }}>{label}</button>)}
          {qr && <a className="text-link" href={qr} download={`${order.reference}-vietqr.png`}>Tải mã QR</a>}
        </div>
        {copyNotice && <p role="status">{copyNotice}</p>}
        <small>
          Kiểm tra đúng tên người nhận và số tiền trong ứng dụng ngân hàng.
          Trạng thái chỉ đổi khi admin kiểm tra đã nhận tiền.
        </small>
      </div>
    </aside>
  );
}
export function MemorySharing({ memory, cardMessage, onChange }) {
  const [mode, setMode] = useState(
      memory.listed ? "GARDEN" : memory.share_token ? "LINK" : "PRIVATE",
    ),
    [signature, setSignature] = useState(memory.signature || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const url = memory.share_token
    ? location.origin + "/#memory/" + memory.share_token
    : "";
  async function share() {
    setBusy(true);
    setError("");
    try {
      const row = await call("gd_share_memory", {
        p_id: memory.id,
        p_visibility: mode,
        p_signature: signature,
      });
      onChange(row);
      setCopied(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="memory-sharing">
      <span className="eyebrow">MỘT DẤU HOA CỦA BẠN</span>
      <h3>
        Giữ riêng, <em>hay gửi đi.</em>
      </h3>
      <blockquote>
        {cardMessage || "Đơn hoa này chưa có lời nhắn trên thiệp."}
      </blockquote>
      {memory.revoked ? (
        <p>
          Kỉ niệm được giữ trong lịch sử riêng; đơn đã hoàn tiền nên không còn
          chia sẻ công khai.
        </p>
      ) : (
        <>
          <p>
            Đây là chính lời nhắn trên thiệp. Khi chia sẻ, người khác chỉ thấy
            lời nhắn, hình hoa và chữ ký bạn chọn. Kiểm tra nội dung để tránh
            công khai thông tin cá nhân.
          </p>
          <label>
            Chia sẻ thế nào
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="PRIVATE">Giữ riêng / rút chia sẻ</option>
              <option value="LINK">Chia sẻ bằng đường dẫn</option>
              <option value="GARDEN">Đường dẫn + đưa vào Vườn kỉ niệm</option>
            </select>
          </label>
          {mode !== "PRIVATE" && (
            <label>
              Chữ ký (bỏ trống để ẩn danh)
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                maxLength={80}
              />
            </label>
          )}
          <button
            className="button outline"
            disabled={busy || (!cardMessage && mode !== "PRIVATE")}
            onClick={share}
          >
            {busy
              ? "Đang lưu…"
              : mode === "PRIVATE"
                ? "Lưu riêng / rút chia sẻ"
                : "Tôi đồng ý chia sẻ lời nhắn trên"}
          </button>
          {url && (
            <div className="sharing-link">
              <a className="text-link" href={"#memory/" + memory.share_token}>
                Xem tấm thiệp
              </a>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                  } catch {
                    setError(
                      "Không sao chép được. Chọn và sao chép đường dẫn bên dưới.",
                    );
                  }
                }}
              >
                {copied ? "Đã sao chép" : "Sao chép link"}
              </button>
              <input readOnly value={url} aria-label="Đường dẫn tấm thiệp" />
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export default function OrderDetail({ order, admin = false, onUpdated }) {
  const [events, setEvents] = useState([]),
    [memory, setMemory] = useState(null),
    [error, setError] = useState("");
  const [status, setStatus] = useState(order.status),
    [payment, setPayment] = useState(order.payment_status),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setStatus(order.status);
    setPayment(order.payment_status);
    let active = true;
    setError("");
    Promise.all([
      result(
        backend
          .from("gd_order_events")
          .select("id,event,note,created_at")
          .eq("order_id", order.id)
          .order("id"),
      ),
      admin
        ? null
        : result(
            backend
              .from("gd_memories")
              .select("*")
              .eq("order_id", order.id)
              .maybeSingle(),
          ),
    ])
      .then(([timeline, m]) => {
        if (active) {
          setEvents(timeline);
          setMemory(m);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [order, admin]);
  async function update(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const note = new FormData(event.currentTarget).get("note");
    try {
      const next = await call("gd_update_order", {
        p_id: order.id,
        p_version: order.version,
        p_status: status,
        p_payment: payment,
        p_note: note,
      });
      onUpdated(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="order-detail">
      <header>
        <span className="eyebrow">{order.reference}</span>
        <h2>
          Một bó hoa, <em>một câu chuyện.</em>
        </h2>
        <p>
          {orderStatuses[order.status]} ·{" "}
          {paymentStatuses[order.payment_status]}
        </p>
      </header>
      <div className="order-detail-grid">
        <section>
          <h3>Những đóa hoa đã chọn</h3>
          {order.items.map((item) => (
            <div className="history-item" key={`${item.id}:${item.variantId ?? "base"}`}>
              <img src={item.image} alt={item.name} />
              <div>
                <strong>{item.name}</strong>
                {item.sizeName && <p>Cỡ {item.sizeName} · {item.sku}</p>}
                <p>
                  {item.quantity} bó · {money(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
          <dl className="order-totals">
            <div>
              <dt>Tiền hoa</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            <div>
              <dt>{order.shipping.name}</dt>
              <dd>{money(order.shipping.fee)}</dd>
            </div>
            <div>
              <dt>Tổng cộng</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>Ngày lời thương đến</h3>
          <p>
            {new Intl.DateTimeFormat("vi-VN").format(
              new Date(order.delivery_date + "T12:00:00+07:00"),
            )}{" "}
            · {order.delivery_time}
          </p>
          <p>
            {order.recipient_name}
            <br />
            {order.recipient_phone}
            <br />
            {order.address ||
              "Thông tin giao hàng đã được xóa theo thời hạn lưu giữ."}
          </p>
          <p>{order.shipping.area}</p>
          <h3>Lời nhắn riêng trên thiệp</h3>
          <blockquote>{order.card_message || "(Không có lời nhắn)"}</blockquote>
        </section>
      </div>
      <BankPayment order={order} />
      <section className="order-timeline">
        <h3>Hành trình của bó hoa</h3>
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span>
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(event.created_at))}
              </span>
              <strong>
                {orderStatuses[event.event.split(" · ")[0]] || event.event}
                {event.event.includes(" · ") &&
                  " · " + paymentStatuses[event.event.split(" · ")[1]]}
              </strong>
              {event.note && <p>{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
      {memory && (
        <MemorySharing
          key={memory.id}
          memory={memory}
          cardMessage={order.card_message}
          onChange={setMemory}
        />
      )}
      {admin && (
        <form className="admin-order-form" onSubmit={update}>
          <h3>Cập nhật đơn & đối soát</h3>
          <div className="form-grid">
            <label>
              Trạng thái đơn
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(orderStatuses).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái tiền
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                {Object.entries(paymentStatuses).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Ghi chú / mã đối soát
            <input
              name="note"
              maxLength={500}
              placeholder="Chỉ xác nhận sau khi kiểm tra ngân hàng hoặc tiền COD"
            />
          </label>
          <p className="fineprint">
            Hoàn tiền tại đây chỉ ghi nhận khoản bạn đã xử lý bên ngoài; website
            không tự chuyển tiền.
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu cập nhật"}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
