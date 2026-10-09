import { useEffect, useRef, useState } from "react";
import { backend, call, result } from "./backend.js";
import { useStore } from "./Store.jsx";
import { sendCheckout } from "./checkout-request.js";
import { canRequestChange, prepareOrderRequest, requestKinds, requestStatuses } from "./order-requests.js";
import "./order-requests.css";

const dateTime = value => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function OrderRequests(props) {
  const { session } = useStore();
  return <RequestPanel key={`${props.order.id}:${session?.user?.id}:${props.admin ? "admin" : "customer"}`} {...props} ownerId={session?.user?.id} />;
}

function RequestPanel({ order, admin = false, onUpdated, ownerId }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState("CONTACT"), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pendingView, setPendingView] = useState(null), [review, setReview] = useState(null);
  const [checkedHistory, setCheckedHistory] = useState(false);
  const pending = useRef(null), sequence = useRef(0), active = useRef(true);
  const open = rows.find(row => row.status === "OPEN");
  async function load() {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const data = await result(backend.from("gd_order_requests")
        .select("id,order_id,kind,body,status,version,response,created_at,processed_at")
        .eq("order_id", order.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30));
      if (!active.current || request !== sequence.current) return;
      setRows(data); setLoaded(true);
      if (pending.current?.request.rpc === "gd_request_order_change" && data.some(row => row.id === pending.current.request.args.p_id)) {
        pending.current = null; setPendingView(null);
        setNotice("Yêu cầu đã có trong lịch sử. Cửa hàng sẽ xem xét thông tin bạn gửi.");
      }
    } finally {
      if (active.current && request === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    load().catch(e => { if (active.current) setError(e.message); });
    return () => { active.current = false; sequence.current++; pending.current = null; };
  }, [order.id]);
  async function refresh() {
    setError("");
    try { await load(); }
    catch (e) { if (active.current) setError(e.message); }
  }
  async function perform(rpc, args) {
    if (busy || !ownerId) return false;
    setBusy(true); setError(""); setNotice(""); setCheckedHistory(false);
    const intent = pending.current?.request || { rpc, args };
    setPendingView(intent);
    try {
      const { order: response } = await sendCheckout(pending, ownerId, intent, request => call(request.rpc, request.args));
      if (!active.current) return false;
      setPendingView(null); setReview(null);
      setNotice(intent.rpc === "gd_withdraw_order_request" ? "Đã rút yêu cầu. Đơn hoa giữ trạng thái hiện tại." : "Đã lưu. Kiểm tra trạng thái và phản hồi trong lịch sử bên dưới.");
      if (response?.order) onUpdated?.(response.order);
      try { await load(); }
      catch (e) { if (active.current) setError(`Thao tác đã được lưu, nhưng chưa tải lại được lịch sử. ${e.message}`); }
      return true;
    } catch (e) {
      if (active.current) { setError(e.message); setPendingView(pending.current?.request || null); }
      return false;
    } finally { if (active.current) setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || pendingView || open) return;
    const form = event.currentTarget;
    try {
      const args = prepareOrderRequest(order, kind, Object.fromEntries(new FormData(form)), crypto.randomUUID());
      if (await perform("gd_request_order_change", args)) form.reset();
    } catch (e) { setError(e.message); }
  }
  const disabled = busy || loading || Boolean(pendingView);
  return <section className="order-requests" aria-label="Yêu cầu thay đổi đơn hoa" aria-busy={busy || loading}>
    <header className="order-requests-heading">
      <div><span className="eyebrow">CÙNG CHĂM CHÚT ĐƠN HOA</span><h3>{admin ? "Yêu cầu từ khách hàng" : "Cần điều chỉnh một chút?"}</h3></div>
      <button type="button" className="text-button" onClick={refresh} disabled={busy || loading}>{loading ? "Đang tải…" : "Tải lại lịch sử"}</button>
    </header>
    <p className="order-request-explanation">Yêu cầu được gửi trực tiếp đến cửa hàng. Đề nghị hủy chưa làm đơn bị hủy và chưa hoàn tiền. Shop xem xét trước khi cập nhật; nếu cần hoàn tiền, shop xử lý và đối soát riêng.</p>
    {notice && <p className="order-request-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {pendingView && <aside className="order-request-recovery" aria-label="Khôi phục thao tác">
      <strong>Chưa nhận được kết quả chắc chắn</strong>
      <p>Lịch sử có thể đã lưu thao tác này. Tải lại để kiểm tra hoặc gửi lại đúng yêu cầu cũ; nội dung đang được giữ nguyên.</p>
      <div className="order-request-actions"><button type="button" className="button outline" disabled={busy || loading} onClick={() => perform(pendingView.rpc, pendingView.args)}>Kiểm tra và gửi lại</button></div>
      <label className="order-request-checkbox"><input type="checkbox" checked={checkedHistory} disabled={busy || loading} onChange={e => setCheckedHistory(e.target.checked)} />Tôi đã tải lại và kiểm tra lịch sử trước khi bỏ thao tác đang giữ.</label>
      <button type="button" className="text-button" disabled={busy || loading || !checkedHistory} onClick={() => { pending.current = null; setPendingView(null); setCheckedHistory(false); setNotice("Đã bỏ nội dung đang giữ trên thiết bị. Thao tác đã lưu ở cửa hàng vẫn nằm trong lịch sử."); }}>Bỏ thao tác đang giữ</button>
    </aside>}
    {!admin && canRequestChange(order) && loaded && !open && <form className="order-request-form" onSubmit={submit}>
      <fieldset disabled={disabled}>
        <legend>Bạn muốn cửa hàng hỗ trợ điều gì?</legend>
        <div className="order-request-types">{Object.entries(requestKinds).map(([value, label]) => <label key={value}><input type="radio" name="request-kind" value={value} checked={kind === value} onChange={() => setKind(value)} /><span>{label}</span></label>)}</div>
        {kind === "CONTACT" && <>
          <p className="fineprint">Chỉ sửa tên và điện thoại người nhận tại địa chỉ đã lưu. Đổi địa chỉ, khu vực hoặc ca giao cần cửa hàng báo lại phí và lịch; biểu mẫu này chưa hỗ trợ các thay đổi đó. Bó hoa, tổng tiền và lời nhắn trên thiệp giữ nguyên.</p>
          <div className="form-grid">
            <label>Tên người nhận mới<input name="name" autoComplete="name" defaultValue={order.recipient_name || ""} required minLength={2} maxLength={80} /></label>
            <label>Số điện thoại mới<input name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={order.recipient_phone || ""} required maxLength={24} /></label>
          </div>
          <label>Địa chỉ giao giữ nguyên<textarea name="address" value={order.address || ""} readOnly rows={2} /></label>
        </>}
        <label>{kind === "CANCEL" ? "Lý do bạn muốn hủy" : "Ghi thêm lý do thay đổi"}<textarea name="reason" required minLength={5} maxLength={500} rows={3} placeholder="Để cửa hàng hỗ trợ đúng nhu cầu của bạn…" /></label>
        <button className="button outline" type="submit">Gửi yêu cầu đến cửa hàng</button>
      </fieldset>
    </form>}
    {!admin && open && <p className="order-request-notice">Bạn có một yêu cầu đang chờ cửa hàng. Có thể rút yêu cầu bên dưới trước khi gửi một yêu cầu khác.</p>}
    {!admin && !canRequestChange(order) && <p className="fineprint">Đơn đã bắt đầu được thực hiện, đã kết thúc hoặc thông tin giao hàng đã hết thời hạn lưu giữ, nên không nhận yêu cầu sửa tại đây.</p>}
    {loaded && !rows.length && <p className="order-request-empty">Chưa có yêu cầu thay đổi cho đơn hoa này.</p>}
    <ol className="order-request-history">{rows.map(row => <li key={row.id}>
      <article className="order-request-card">
        <div className="order-request-card-top"><h4>{requestKinds[row.kind] || "Yêu cầu thay đổi"}</h4><span className={`order-request-status ${row.status === "OPEN" ? "is-open" : ""}`}>{requestStatuses[row.status] || "Đang cập nhật"}</span></div>
        <time dateTime={row.created_at}>Gửi lúc {dateTime(row.created_at)}</time>
        {order.contacts_erased_at ? <p>Thông tin chi tiết của yêu cầu đã hết thời hạn lưu giữ.</p> : <>
          <p className="order-request-reason">{row.body?.reason}</p>
          {row.kind === "CONTACT" && <dl><div><dt>Người nhận đề xuất</dt><dd>{row.body?.name}</dd></div><div><dt>Điện thoại</dt><dd>{row.body?.phone}</dd></div><div><dt>Địa chỉ giữ nguyên</dt><dd>{row.body?.address}</dd></div></dl>}
          {row.response && <blockquote><span>Phản hồi từ cửa hàng</span>{row.response}</blockquote>}
        </>}
        {row.processed_at && <time dateTime={row.processed_at}>Xử lý lúc {dateTime(row.processed_at)}</time>}
        {row.status === "OPEN" && <div className="order-request-actions">{admin ? <button type="button" className="button outline" disabled={disabled} onClick={() => setReview(row)}>Xem xét yêu cầu</button> : <button type="button" className="text-button" disabled={disabled} onClick={() => perform("gd_withdraw_order_request", { p_id: row.id, p_version: row.version })}>Rút yêu cầu này</button>}</div>}
        {admin && row.status === "OPEN" && review?.id === row.id && <form className="order-request-review" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget, event.nativeEvent.submitter);
          perform("gd_resolve_order_request", { p_id: row.id, p_version: row.version, p_accept: fields.get("decision") === "accept", p_response: String(fields.get("response") || "").trim() });
        }}>
          <fieldset disabled={disabled}><legend>Phản hồi cho khách hàng</legend>
            <p className="fineprint">{row.kind === "CANCEL" ? "Chấp thuận sẽ hủy đơn nếu đơn vẫn đủ điều kiện. Tiền đã nhận vẫn cần hoàn và đối soát thủ công." : "Chấp thuận chỉ cập nhật tên và điện thoại tại cùng địa chỉ đã lưu. Nếu khách muốn đổi địa chỉ hoặc lịch giao trong lý do, từ chối yêu cầu này và báo cần quy trình báo giá giao mới."}</p>
            <label>Nội dung phản hồi<textarea name="response" required minLength={5} maxLength={500} rows={3} /></label>
            <div className="order-request-actions"><button type="submit" className="button outline" name="decision" value="reject">Từ chối và gửi phản hồi</button><button type="submit" className="button primary" name="decision" value="accept">Chấp thuận yêu cầu</button><button type="button" className="text-button" onClick={() => setReview(null)}>Để sau</button></div>
          </fieldset>
        </form>}
      </article>
    </li>)}</ol>
    {rows.length === 30 && <p className="fineprint">Đang hiển thị 30 yêu cầu gần nhất của đơn này.</p>}
  </section>;
}
