import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useRef, useState } from "react";
import { backend, call, result, orderColumns, orderStatuses, paymentStatuses } from "./backend.js";
import { useStore } from "./Store.jsx";
import { money } from "./catalog.js";
import { vietnamDate } from "./order.js";
import OrderDetail from "./OrderDetail.jsx";
import { validateReconciliationReport } from "./reconciliation.js";
import "./reconciliation-desk.css";

const paymentFilters = [
  ["ALL", "Mọi trạng thái"],
  ["UNPAID", "Chưa thu đủ"],
  ["PAID", "Đã nhận tiền"],
  ["REFUNDED", "Đã hoàn tiền"],
];
const dateLabel = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
const stampLabel = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function ReconciliationWorkspace() {
  const today = vietnamDate();
  const monthStart = today.slice(0, 8) + "01";
  const [filter, setFilter] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [queueRevision, setQueueRevision] = useState(0);
  const [reportRevision, setReportRevision] = useState(0);
  const [draftFrom, setDraftFrom] = useState(monthStart);
  const [draftTo, setDraftTo] = useState(today);
  const [period, setPeriod] = useState({ from: monthStart, to: today });
  const [rows, setRows] = useState([]);
  const [loadedQueue, setLoadedQueue] = useState("");
  const [more, setMore] = useState(false);
  const [queueBusy, setQueueBusy] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [queueTime, setQueueTime] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [reportBusy, setReportBusy] = useState(true);
  const [reportError, setReportError] = useState("");
  const [reportTime, setReportTime] = useState(null);
  const [selected, setSelected] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const mounted = useRef(false);
  const queueSequence = useRef(0);
  const reportSequence = useRef(0);
  const detailSequence = useRef(0);
  const selectedId = useRef(null);
  const detailBack = useRef(null);
  const queueHeading = useRef(null);
  const returnFocus = useRef(false);
  const queueFilter = JSON.stringify([filter, method, query]);
  const queueKey = JSON.stringify([filter, method, query, queueRevision]);
  const periodFilter = JSON.stringify([period.from, period.to]);
  const reportKey = JSON.stringify([period.from, period.to, reportRevision]);
  const currentQueue = useRef(queueKey);
  const currentReport = useRef(reportKey);
  currentQueue.current = queueKey;
  currentReport.current = reportKey;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueSequence.current += 1;
      reportSequence.current += 1;
      detailSequence.current += 1;
    };
  }, []);

  async function loadQueue(append = false) {
    const request = ++queueSequence.current;
    const key = queueKey;
    const last = append ? rows.at(-1) : null;
    setQueueBusy(true);
    setQueueError("");
    try {
      const page = await call("gd_reconciliation_queue", {
        p_filter: filter,
        p_method: method,
        p_search: query,
        p_before: last?.created_at ?? null,
        p_before_id: last?.id ?? null,
        p_limit: 30,
      });
      if (!mounted.current || queueSequence.current !== request || currentQueue.current !== key) return;
      setRows(previous => append ? [...previous, ...page.slice(0, 30)] : page.slice(0, 30));
      setLoadedQueue(queueFilter);
      setMore(page.length > 30);
      setQueueTime(new Date());
    } catch (failure) {
      if (mounted.current && queueSequence.current === request && currentQueue.current === key) setQueueError(failure.message);
    } finally {
      if (mounted.current && queueSequence.current === request && currentQueue.current === key) setQueueBusy(false);
    }
  }

  useEffect(() => {
    setOpeningId(null);
    setDetailError("");
    detailSequence.current += 1;
    loadQueue();
    return () => { queueSequence.current += 1; };
  }, [queueKey]);

  useEffect(() => {
    const request = ++reportSequence.current;
    const key = reportKey;
    setReportBusy(true);
    setReportError("");
    call("gd_reconciliation_totals", { p_from: period.from, p_to: period.to })
      .then(report => {
        if (!mounted.current || reportSequence.current !== request || currentReport.current !== key) return;
        setTotals(validateReconciliationReport(report, period));
        setLoadedPeriod(periodFilter);
        setReportTime(new Date());
      })
      .catch(failure => {
        if (mounted.current && reportSequence.current === request && currentReport.current === key) setReportError(failure.message);
      })
      .finally(() => {
        if (mounted.current && reportSequence.current === request && currentReport.current === key) setReportBusy(false);
      });
    return () => { reportSequence.current += 1; };
  }, [reportKey]);

  useEffect(() => {
    if (selected) detailBack.current?.focus();
    else if (returnFocus.current) {
      queueHeading.current?.focus();
      returnFocus.current = false;
    }
  }, [selected?.id]);

  async function openOrder(row) {
    const request = ++detailSequence.current;
    const key = queueKey;
    setOpeningId(row.id);
    setDetailError("");
    try {
      const order = await result(backend.from("gd_orders").select(orderColumns).eq("id", row.id).single());
      if (!mounted.current || detailSequence.current !== request || currentQueue.current !== key) return;
      selectedId.current = order.id;
      setSelected(order);
    } catch (failure) {
      if (mounted.current && detailSequence.current === request && currentQueue.current === key) setDetailError(failure.message);
    } finally {
      if (mounted.current && detailSequence.current === request) setOpeningId(null);
    }
  }

  async function refreshDetail() {
    if (!selected || detailBusy) return;
    const request = ++detailSequence.current;
    const id = selected.id;
    setDetailBusy(true);
    setDetailError("");
    try {
      const order = await result(backend.from("gd_orders").select(orderColumns).eq("id", id).single());
      if (!mounted.current || detailSequence.current !== request || selectedId.current !== id) return;
      setSelected(order);
    } catch (failure) {
      if (mounted.current && detailSequence.current === request && selectedId.current === id) setDetailError(failure.message);
    } finally {
      if (mounted.current && detailSequence.current === request) setDetailBusy(false);
    }
  }

  function backToQueue() {
    detailSequence.current += 1;
    selectedId.current = null;
    returnFocus.current = true;
    setSelected(null);
    setDetailBusy(false);
    setDetailError("");
    setQueueRevision(value => value + 1);
    setReportRevision(value => value + 1);
  }

  function applyPeriod(from, to) {
    setDraftFrom(from);
    setDraftTo(to);
    setPeriod({ from, to });
    setReportRevision(value => value + 1);
  }

  if (selected) return (
    <section className="reconciliation-desk" aria-label={`Đối soát đơn ${selected.reference}`}>
      <div className="reconciliation-detail-tools">
        <button ref={detailBack} type="button" className="text-button" onClick={backToQueue}>← Trở về bàn đối soát</button>
        <button type="button" className="button outline" disabled={detailBusy} onClick={refreshDetail}>{detailBusy ? "Đang cập nhật…" : "Tải lại đơn và số dư"}</button>
      </div>
      {detailBusy && <p role="status">Đang lấy thông tin mới nhất…</p>}
      {detailError && <p className="form-error" role="alert">{detailError}</p>}
      <OrderDetail key={selected.id} order={selected} admin onUpdated={order => {
        if (!mounted.current || selectedId.current !== order.id) return;
        detailSequence.current += 1;
        setDetailBusy(false);
        setDetailError("");
        setSelected(order);
      }} />
    </section>
  );

  const visibleRows = loadedQueue === queueFilter ? rows : [];
  const report = loadedPeriod === periodFilter ? totals : null;
  return (
    <section className="reconciliation-desk" aria-labelledby="reconciliation-heading">
      <div className="portal-section-heading reconciliation-heading">
        <div><span className="eyebrow">TIỀN THU · TIỀN HOÀN</span><h2 id="reconciliation-heading">Bàn đối soát</h2></div>
        <button type="button" className="button outline" disabled={queueBusy || reportBusy} onClick={() => { setQueueRevision(value => value + 1); setReportRevision(value => value + 1); }}>Cập nhật toàn bộ</button>
      </div>
      <p className="reconciliation-intro">Kiểm tra tiền COD hoặc tiền về ngân hàng trước khi xác nhận. Ghi nhận trên website lưu sổ đối soát; thao tác hoàn tiền không tự chuyển tiền cho khách.</p>
      <section className="reconciliation-report" aria-labelledby="reconciliation-period-heading" aria-busy={reportBusy}>
        <div className="reconciliation-report-heading"><div><h3 id="reconciliation-period-heading">Thu và hoàn trong kỳ</h3><p>Theo ngày thực thu / thực hoàn, giờ Việt Nam. Kỳ tối đa 92 ngày.</p></div><div className="reconciliation-quick-period"><button type="button" className="text-button" onClick={() => applyPeriod(today, today)}>Hôm nay</button><button type="button" className="text-button" onClick={() => applyPeriod(monthStart, today)}>Tháng này</button></div></div>
        <form className="reconciliation-period-form" onSubmit={event => { event.preventDefault(); applyPeriod(draftFrom, draftTo); }}>
          <label>Từ ngày<input type="date" value={draftFrom} max={draftTo || undefined} required onChange={event => setDraftFrom(event.target.value)} /></label>
          <label>Đến ngày<input type="date" value={draftTo} min={draftFrom || undefined} required onChange={event => setDraftTo(event.target.value)} /></label>
          <button className="button outline" disabled={reportBusy}>Xem kỳ này</button>
        </form>
        {reportError && <div className="reconciliation-error" role="alert"><p>{reportError}</p><button type="button" className="text-button" disabled={reportBusy} onClick={() => setReportRevision(value => value + 1)}>Tải lại kỳ đã chọn</button>{report && <p>Số liệu dưới đây là lần tải trước; chưa phải bản cập nhật.</p>}</div>}
        {reportBusy && <BloomLoader compact label="Sổ thu & hoàn tiền" />}
        {report && <>
          <p className="reconciliation-period-caption">Kỳ {dateLabel.format(new Date(period.from + "T12:00:00+07:00"))} — {dateLabel.format(new Date(period.to + "T12:00:00+07:00"))}{reportTime && ` · Tải lúc ${stampLabel.format(reportTime)}`}{reportBusy ? " · Đang cập nhật" : ""}</p>
          <dl className="reconciliation-metrics">
            <div><dt>Tiền đã thu trong kỳ</dt><dd>{money(report.received)}</dd></div>
            <div><dt>Tiền đã hoàn trong kỳ</dt><dd>{money(report.refunded)}</dd></div>
            <div><dt>Tiền thu trừ hoàn trong kỳ</dt><dd>{money(report.netCollected)}</dd></div>
          </dl>
          <p className="reconciliation-definition">{report.eventCount} bút toán có ngày trong kỳ. Số âm có thể xuất hiện khi hoàn cho khoản thu của kỳ trước. Đây là dòng tiền đã đối soát; chưa phải doanh thu hoặc lợi nhuận.</p>
          <div className="reconciliation-legacy"><h4>Số dư chuyển từ dữ liệu cũ</h4><dl><div><dt>Tiền thu cũ chưa xác định ngày</dt><dd>{money(report.legacyReceiptBalance)}</dd></div><div><dt>Tiền hoàn cũ chưa xác định ngày</dt><dd>{money(report.legacyRefundBalance)}</dd></div></dl><p>Các số dư cũ tính toàn bộ lịch sử, không cộng vào kỳ trên vì chưa có ngày thực thu / thực hoàn xác thực.</p></div>
        </>}
      </section>
      <section className="reconciliation-queue" aria-labelledby="reconciliation-queue-heading" aria-busy={queueBusy || !!openingId}>
        <div className="reconciliation-queue-heading"><h3 ref={queueHeading} tabIndex={-1} id="reconciliation-queue-heading">Đơn cần kiểm tra</h3><button type="button" className="text-button" disabled={queueBusy} onClick={() => setQueueRevision(value => value + 1)}>Tải lại danh sách</button></div>
        <p className="reconciliation-definition">Danh sách theo trạng thái tiền và phương thức, độc lập với kỳ báo cáo phía trên. Mở từng đơn để xem chứng cứ và ghi nhận tiền. Ngày sắp xếp là ngày tạo đơn.</p>
        <div className="reconciliation-queue-filters">
          <label>Trạng thái tiền<select value={filter} onChange={event => setFilter(event.target.value)}>{paymentFilters.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>Phương thức<select value={method} onChange={event => setMethod(event.target.value)}><option value="ALL">COD và chuyển khoản</option><option value="COD">COD</option><option value="VIETQR">Chuyển khoản VietQR</option></select></label>
          <form onSubmit={event => { event.preventDefault(); setQuery(search.trim().toUpperCase()); }}><label>Mã đơn<input value={search} maxLength={40} pattern="GD-[A-Z0-9-]*" onChange={event => setSearch(event.target.value.toUpperCase())} placeholder="GD-…" aria-describedby="reconciliation-search-hint" /></label><button className="button outline">Tìm</button>{query && <button type="button" className="text-button" onClick={() => { setSearch(""); setQuery(""); }}>Xóa mã</button>}</form>
        </div>
        <p id="reconciliation-search-hint" className="reconciliation-definition">Tìm theo mã bắt đầu bằng GD-. Danh sách không hiển thị số điện thoại, địa chỉ, người nhận hoặc lời nhắn.</p>
        {queueError && <div className="reconciliation-error" role="alert"><p>{queueError}</p><button type="button" className="text-button" disabled={queueBusy} onClick={() => setQueueRevision(value => value + 1)}>Thử tải lại danh sách</button>{visibleRows.length > 0 && <p>Các đơn bên dưới là lần tải trước, số dư có thể đã thay đổi.</p>}</div>}
        {detailError && <p className="form-error" role="alert">{detailError}</p>}
        {queueBusy && <p className="reconciliation-loading" role="status">Đang cập nhật danh sách đối soát…</p>}
        {openingId && <BloomLoader compact label="Chi tiết đơn hoa" />}
        {loadedQueue === queueFilter && !queueBusy && !queueError && !visibleRows.length && <div className="portal-empty"><h4>Chưa có đơn phù hợp.</h4><p>Đổi trạng thái tiền, phương thức hoặc mã đơn để kiểm tra.</p></div>}
        {!!visibleRows.length && <>
          <p className="reconciliation-period-caption">Đã tải {visibleRows.length} đơn{queueTime && ` · ${stampLabel.format(queueTime)}`}{queueBusy ? " · Đang cập nhật" : ""}. Số liệu từng đơn gồm toàn bộ bút toán của đơn đó.</p>
          <ul className="reconciliation-orders">{visibleRows.map(row => <li key={row.id}><button type="button" className="reconciliation-order" disabled={queueBusy || !!openingId} onClick={() => openOrder(row)}>
            <div className="reconciliation-order-main"><strong>{row.reference}</strong><span>{stampLabel.format(new Date(row.created_at))}</span><div><span className="status-badge">{paymentStatuses[row.payment_status]}</span><span>{row.payment_method === "COD" ? "COD" : "VietQR"} · {orderStatuses[row.status]}</span></div></div>
            <dl className="reconciliation-order-balances"><div><dt>Giá trị đơn</dt><dd>{money(row.total)}</dd></div><div><dt>Đã thu / đã hoàn</dt><dd>{money(row.received)} / {money(row.refunded)}</dd></div><div><dt>Tiền giữ lại</dt><dd>{money(row.heldCash)}</dd></div><div><dt>Còn phải thu</dt><dd>{money(row.receivable)}</dd></div></dl>
            <span className="reconciliation-order-open">Mở & đối soát <span aria-hidden="true">↗</span></span>
          </button></li>)}</ul>
        </>}
        {more && loadedQueue === queueFilter && <div className="reconciliation-pagination"><button type="button" className="button outline" disabled={queueBusy || !!openingId} onClick={() => loadQueue(true)}>Tải thêm 30 đơn</button><p>Danh sách chưa bao gồm tất cả đơn. Báo cáo trong kỳ phía trên được tính tại server, độc lập số trang đã tải.</p></div>}
      </section>
    </section>
  );
}

export default function ReconciliationDesk() {
  const { session, isAdmin } = useStore();
  if (!session || !isAdmin) return null;
  return <ReconciliationWorkspace key={session.user.id} />;
}
