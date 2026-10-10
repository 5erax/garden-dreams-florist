import { useEffect, useRef, useState } from "react";
import { backend, call, result } from "./backend.js";
import { money } from "./catalog.js";
import { useStore } from "./Store.jsx";
import { sendCheckout } from "./checkout-request.js";
import { allowedReconciliationActions, prepareReconciliation, reconciliationActions, validatePaymentBalance } from "./reconciliation.js";
import "./reconciliation.css";

const dateTime = value => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const methods = { COD: "Tiền COD", VIETQR: "Chuyển khoản VietQR" };

export default function Reconciliation(props) {
  const { session } = useStore();
  return <PaymentPanel key={`${props.order.id}:${session?.user?.id}:${props.admin ? "admin" : "customer"}`} {...props} ownerId={session?.user?.id} />;
}

function PaymentPanel({ order, admin, onUpdated, ownerId }) {
  const [snapshot, setSnapshot] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pendingView, setPendingView] = useState(null), [checkedHistory, setCheckedHistory] = useState(false);
  const pending = useRef(null), sequence = useRef(0), active = useRef(true);
  const current = snapshot?.version === order.version ? snapshot : null;
  const balance = current?.balance;
  const actions = allowedReconciliationActions(order, balance);
  async function load(saved = false) {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const [value, rows] = await Promise.all([
        call("gd_payment_balance", { p_order: order.id }),
        admin ? result(backend.from("gd_payment_ledger")
          .select("id,order_id,kind,amount,payment_method,reference,evidence,actor_id,order_version,source,effective_at,created_at")
          .eq("order_id", order.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30)) : [],
      ]);
      const balance = validatePaymentBalance(value, order.id);
      if (!active.current || request !== sequence.current) return;
      setSnapshot({ balance, rows, version: order.version });
      if (pending.current && rows.some(row => row.id === pending.current.request.p_id))
        setNotice("Thao tác đang giữ đã có trong sổ. Gửi lại đúng thao tác để cập nhật trạng thái đơn; hệ thống dùng cùng mã đối soát.");
    } catch (e) {
      if (active.current && request === sequence.current)
        setError(`${saved ? "Thao tác đã lưu, nhưng chưa tải lại được sổ. " : ""}${e.message}`);
    } finally {
      if (active.current && request === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; sequence.current++; pending.current = null; };
  }, []);
  useEffect(() => {
    setError(""); load();
    return () => { sequence.current++; };
  }, [order.id, order.version, admin]);
  async function perform(args) {
    if (busy || !ownerId) return false;
    setBusy(true); setError(""); setNotice(""); setCheckedHistory(false);
    const intent = pending.current?.request || args;
    setPendingView(intent);
    try {
      const { order: response } = await sendCheckout(pending, ownerId, intent, request => call("gd_reconcile_payment", request));
      if (!active.current) return false;
      setPendingView(null);
      setNotice(intent.p_action === "RECEIPT" ? "Đã ghi nhận thu đủ tiền. Đây là kết quả đối soát của cửa hàng." : "Đã ghi nhận khoản hoàn đã xử lý bên ngoài. Website không tự chuyển tiền hoàn.");
      onUpdated?.(response.order);
      await load(true);
      return true;
    } catch (e) {
      if (active.current) { setError(e.message); setPendingView(pending.current?.request || null); }
      return false;
    } finally { if (active.current) setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || pendingView || loading || !balance) return;
    const form = event.currentTarget, fields = new FormData(form);
    try {
      const args = prepareReconciliation(order, balance, { action: fields.get("action"), evidence: fields.get("evidence"), reference: fields.get("reference"), checked: fields.get("checked") === "on" }, crypto.randomUUID());
      if (await perform(args)) form.reset();
    } catch (e) { setError(e.message); }
  }
  const disabled = loading || busy || Boolean(pendingView);
  return <section className="reconciliation" aria-label="Số dư và đối soát thanh toán" aria-busy={loading || busy}>
    <header className="reconciliation-heading"><div><span className="eyebrow">THANH TOÁN RÕ RÀNG</span><h3>{admin ? "Sổ đối soát của đơn" : "Khoản thanh toán của bạn"}</h3></div>
      <button className="text-button" type="button" disabled={loading || busy} onClick={() => { setError(""); load(); }}>Làm mới số dư</button></header>
    <p className="reconciliation-explanation">Tiền thu và tiền hoàn chỉ được ghi nhận khi cửa hàng kiểm tra thực tế. Đã giao hoa hoặc đã hiển thị QR chưa có nghĩa là cửa hàng đã nhận tiền.</p>
    {error && <p className="form-error" role="alert">{error}{balance && " Số dư bên dưới là lần tải thành công trước; chưa dùng để đối soát thêm."}</p>}
    {notice && <p className="reconciliation-notice" role="status">{notice}</p>}
    {balance && <>
      <dl className="reconciliation-balances">
        {[["Giá trị đơn", balance.total], ["Đã ghi nhận thu", balance.received], ["Đã ghi nhận hoàn", balance.refunded], ["Tiền đang giữ sau hoàn", balance.heldCash], ["Còn cần thu", balance.receivable]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{money(amount)}</dd></div>)}
      </dl>
      {balance.legacyBalance && <p className="reconciliation-legacy">Số dư có dữ liệu từ trước khi mở sổ đối soát. Thời điểm thu/hoàn thực tế của các mục cũ chưa được xác định.</p>}
      {order.status === "CANCELLED" && balance.refundable > 0 && <p className="reconciliation-notice">Đơn đã hủy và còn {money(balance.refundable)} đủ điều kiện ghi nhận hoàn. Cửa hàng cần xử lý khoản hoàn bên ngoài và kiểm tra trước khi cập nhật.</p>}
      {!admin && <p className="fineprint">Bạn không cần gửi chứng từ tại đây. Nếu trạng thái chưa khớp, liên hệ cửa hàng với mã {order.reference}; giữ thông tin ngân hàng và thông tin cá nhân riêng tư.</p>}
    </>}
    {admin && pendingView && !busy && <aside className="reconciliation-recovery">
      <strong>Kiểm tra sổ trước khi thử lại</strong><p>Kết nối có thể đã ngắt sau khi lưu. Nội dung và mã thao tác cũ đang được giữ; không ghi thêm một khoản thu/hoàn khác.</p>
      <p>{reconciliationActions[pendingView.p_action]} · {money(order.total)} · Mã thao tác <code>{pendingView.p_id}</code></p>
      <button className="button outline" type="button" disabled={loading} onClick={() => perform(pendingView)}>Gửi lại đúng thao tác đang giữ</button>
      <label className="reconciliation-checkbox"><input type="checkbox" checked={checkedHistory} disabled={loading} onChange={e => setCheckedHistory(e.target.checked)} />Tôi đã tải lại và kiểm tra sổ trước khi bỏ thao tác đang giữ.</label>
      <button className="text-button" type="button" disabled={loading || !checkedHistory} onClick={() => { pending.current = null; setPendingView(null); setCheckedHistory(false); setNotice("Đã bỏ nội dung đang giữ trên thiết bị. Bút toán đã lưu vẫn còn trong sổ; không thực hiện chuyển tiền lần nữa chỉ vì đóng thao tác này."); }}>Bỏ thao tác đang giữ</button>
    </aside>}
    {admin && balance && actions.length > 0 && <form className="reconciliation-form" onSubmit={submit}>
      <fieldset disabled={disabled || Boolean(error)}><legend>{actions[0] === "RECEIPT" ? "Đối soát khoản đã thu" : "Đối soát khoản đã hoàn"}</legend>
        <input type="hidden" name="action" value={actions[0]} />
        <div className="reconciliation-action-summary"><span>{reconciliationActions[actions[0]]}</span><strong>{money(balance.total)}</strong></div>
        <p className="fineprint">Chỉ ghi nhận toàn bộ khoản tiền của đơn. Số tiền lấy từ dữ liệu đơn trên máy chủ; chưa hỗ trợ thu hoặc hoàn một phần.</p>
        <label>Tham chiếu ngân hàng / chứng từ (nếu có)<input name="reference" maxLength={120} autoComplete="off" spellCheck={false} placeholder={order.payment_method === "COD" ? "COD-CA-001" : "MB-TRANSACTION-001"} /></label>
        <label>Nội dung đã kiểm tra<textarea name="evidence" required minLength={5} maxLength={500} rows={3} placeholder="Ghi căn cứ đối soát; không chép lời nhắn riêng, địa chỉ hoặc số điện thoại người nhận." /></label>
        <label className="reconciliation-checkbox"><input name="checked" type="checkbox" required />{actions[0] === "RECEIPT" ? "Tôi đã kiểm tra thực tế và cửa hàng đã nhận đủ tiền của đơn này." : "Tôi đã xử lý hoàn đủ tiền bên ngoài và kiểm tra khoản hoàn thành công."}</label>
        <button className="button primary" type="submit">{busy ? "Đang ghi nhận…" : reconciliationActions[actions[0]]}</button>
      </fieldset>
    </form>}
    {admin && balance && !actions.length && <p className="fineprint">Không có thao tác thu/hoàn toàn phần khả dụng ở trạng thái hiện tại. Đơn hủy chưa thu không nhận thêm tiền; đơn đã hoàn không ghi nhận hoàn lần nữa.</p>}
    {admin && current && <section className="reconciliation-history" aria-label="Các bút toán riêng của cửa hàng"><h4>Lịch sử đối soát</h4>
      {!current.rows.length && <p>Chưa có bút toán thu hoặc hoàn cho đơn này.</p>}
      <ol>{current.rows.map(row => <li key={row.id}><article>
        <header><div><strong>{row.kind === "RECEIPT" ? "Đã ghi nhận thu" : "Đã ghi nhận hoàn"}</strong><p>{methods[row.payment_method] || "Phương thức chưa xác định"}</p></div><span>{money(Number(row.amount))}</span></header>
        <p className="reconciliation-source">{row.source === "LEGACY" ? "Dữ liệu trước sổ đối soát" : "Đối soát thủ công"} · Phiên bản đơn {row.order_version}</p>
        {row.effective_at ? <time dateTime={row.effective_at}>Ghi nhận đối soát: {dateTime(row.effective_at)}</time> : <p className="reconciliation-unknown-date">Chưa xác định ngày thu/hoàn thực tế. Ngày nhập sổ bên dưới không phải ngày thu/hoàn.</p>}
        <time dateTime={row.created_at}>Nhập sổ hệ thống: {dateTime(row.created_at)}</time>
        <details><summary>Xem căn cứ và mã truy vết</summary><dl><div><dt>Tham chiếu</dt><dd>{row.reference || "Không có tham chiếu riêng"}</dd></div><div><dt>Căn cứ</dt><dd className="reconciliation-evidence">{row.evidence || "Dữ liệu chuyển từ trạng thái trước khi có sổ"}</dd></div><div><dt>Mã bút toán</dt><dd><code>{row.id}</code></dd></div><div><dt>Người ghi nhận</dt><dd><code>{row.actor_id || "Không xác định từ dữ liệu cũ"}</code></dd></div></dl></details>
      </article></li>)}</ol>
      {current.rows.length === 30 && <p className="fineprint">Hiển thị 30 bút toán gần nhất.</p>}
    </section>}
  </section>;
}
