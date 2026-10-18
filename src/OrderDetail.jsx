import BloomLoader from './BloomLoader.jsx';
import RescheduleOrder from './RescheduleOrder.jsx';
import {formatDateTime,isOverdue} from "./admin-ux.js";
import { nextOrderStatus, OrderProgress, OrderTools } from "./OrderTools.jsx";
import BloomSelect from "./BloomSelect.jsx";
import { useEffect, useState } from "react";
import { BankPayment } from "./BankPayment.jsx";
export { BankPayment } from "./BankPayment.jsx";
import {
  backend,
  call,
  result,
  orderStatuses,
  paymentStatuses,
} from "./backend.js";
import { money } from "./catalog.js";

import { useStore } from "./Store.jsx";
import OrderRequests from "./OrderRequests.jsx";
import Reconciliation from "./Reconciliation.jsx";

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
      {memory.moderation_removed && <p role="status">Shop đã gỡ lời nhắn khỏi khu vườn. Lịch sử đơn và lời nhắn riêng của bạn vẫn được giữ.</p>}
      {memory.revoked ? (
        <p>
          Kỷ niệm được giữ trong lịch sử riêng; đơn đã hoàn tiền nên không còn
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
            <BloomSelect value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="PRIVATE">Giữ riêng / rút chia sẻ</option>
              <option value="LINK">Chia sẻ bằng đường dẫn</option>
              <option value="GARDEN">Đường dẫn + đưa vào Vườn kỷ niệm</option>
            </BloomSelect>
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
  const { features } = useStore();
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
          .select(admin ? "id,event,note,created_at,actor_id" : "id,event,note,created_at")
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
        p_payment: features.reconciliationLedger ? order.payment_status : payment,
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
        <span className="eyebrow">CHI TIẾT ĐƠN HOA</span>
        <h2>{order.reference}</h2>
        <p>
          <span className="status-badge">{orderStatuses[order.status]}</span> <span className="status-badge">{paymentStatuses[order.payment_status]}</span>
        </p>
      </header>
      <OrderProgress order={order} /><OrderTools order={order} admin={admin} />
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
          <h3>Giao hoa & người nhận</h3>
          <p>
            {new Intl.DateTimeFormat("vi-VN").format(
              new Date(order.delivery_date + "T12:00:00+07:00"),
            )}{" "}
            · {order.delivery_time}
          </p>
          <dl className="order-contact"><div><dt>Người nhận</dt><dd>{order.recipient_name || "Thông tin đã hết hạn lưu"}</dd></div><div><dt>Điện thoại</dt><dd>{order.recipient_phone || "—"}</dd></div><div><dt>Địa chỉ giao</dt><dd>{order.address || "Thông tin giao hàng đã được xóa theo thời hạn lưu giữ."}</dd></div><div><dt>Người đặt</dt><dd>{order.buyer_name || (admin?"Đơn cũ chưa lưu thông tin người đặt riêng":"Tài khoản đang xem đơn này")}</dd></div>{order.buyer_phone && <div><dt>Điện thoại người đặt</dt><dd>{order.buyer_phone}</dd></div>}</dl>
          <p>{order.shipping.area}</p>
          <h3>Lời nhắn trên thiệp</h3>
          <blockquote>{order.card_message || "(Không có lời nhắn)"}</blockquote>
        </section>
      </div>
      {!admin && <BankPayment order={order} />}
      {features.reconciliationLedger && <Reconciliation key={order.id} order={order} admin={admin} onUpdated={onUpdated} />}
      {features.orderRequests && <OrderRequests key={order.id} order={order} admin={admin} onUpdated={onUpdated} />}
      <section className="order-timeline">
        <h3>Hành trình của bó hoa</h3>
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span>
                {formatDateTime(event.created_at)}
              </span>
              <strong>
                {orderStatuses[event.event.split(" · ")[0]] || event.event}
                {event.event.includes(" · ") &&
                  " · " + paymentStatuses[event.event.split(" · ")[1]]}
              </strong>
              {admin && <small>Người thao tác: {event.actor_id ? event.actor_id===order.owner_id?'Khách đặt hoa':'Nhân viên cửa hàng':'Hệ thống'}</small>}{event.note && <p>{event.note}</p>}
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
      {admin && <RescheduleOrder order={order} onUpdated={onUpdated}/>}
      {admin && (
        <form className="admin-order-form" onSubmit={update}>
          <h3>{features.reconciliationLedger ? "Cập nhật tiến trình" : "Cập nhật đơn & đối soát"}</h3>
          {nextOrderStatus(order.status) && !(order.status==='PENDING'&&isOverdue(order)) && <button type="button" className="button primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{onUpdated(await call('gd_update_order',{p_id:order.id,p_version:order.version,p_status:nextOrderStatus(order.status),p_payment:order.payment_status,p_note:''}));}catch(e){setError(e.message);}finally{setBusy(false);}}}>Chuyển sang: {orderStatuses[nextOrderStatus(order.status)]}</button>}
          {isOverdue(order) && <p className="form-error">Đơn đã quá khung giờ giao. Liên hệ khách để thống nhất lịch khác hoặc hủy; không xác nhận giờ giao cũ.</p>}
          <details className="advanced-order"><summary>Nâng cao: thay đổi trạng thái / hủy đơn</summary><div className="form-grid">
            <label>
              Trạng thái đơn
              <BloomSelect
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(orderStatuses).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </BloomSelect>
            </label>
            <label>
              Trạng thái tiền
              <BloomSelect
                value={payment}
                disabled={features.reconciliationLedger}
                onChange={(e) => setPayment(e.target.value)}
              >
                {Object.entries(paymentStatuses).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </BloomSelect>
            </label>
          </div>
          <label>
            {features.reconciliationLedger ? "Ghi chú tiến trình (khách đọc được)" : "Ghi chú / mã đối soát"}
            <input
              name="note"
              required minLength={5}
              maxLength={500}
              placeholder={features.reconciliationLedger ? "Ví dụ: hoa đã sẵn sàng để giao" : "Chỉ xác nhận sau khi kiểm tra ngân hàng hoặc tiền COD"}
            />
          </label>
          <p className="fineprint">
            {features.reconciliationLedger ? "Ghi nhận tiền thu/hoàn và chứng từ trong sổ đối soát phía trên." : "Hoàn tiền tại đây chỉ ghi nhận khoản bạn đã xử lý bên ngoài; website không tự chuyển tiền."}
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu cập nhật"}
          </button></details>
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
