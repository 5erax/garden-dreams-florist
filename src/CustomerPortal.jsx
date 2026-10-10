import BloomSelect from "./BloomSelect.jsx";
import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useRef, useState } from "react";
import { backend, result, orderColumns, orderStatuses, paymentStatuses } from "./backend.js";
import { useStore } from "./Store.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import { authErrorMessage } from "./auth-error.js";
import OrderDetail from "./OrderDetail.jsx";
import { money } from "./catalog.js";
import { beforeCursor } from "./cursor.js";
import GuestAccount from "./GuestAccount.jsx";
import ReorderFlowers from "./ReorderFlowers.jsx";
import {
  historyPageSize, historyLimit, historyViews, historySummary,
  filterHistory, mergeHistoryPage, historyDate, historyItemTitle, historyNextStep,
} from "./customer-history.js";
import "./customer-history.css";

function HistoryCard({ order, onOpen, buttonRef }) {
  const item = order.items?.[0];
  return (
    <li>
      <button ref={buttonRef} type="button" className="customer-order-card" onClick={() => onOpen(order)}>
        <div className="customer-order-picture">
          {item?.image ? <img src={item.image} alt="" loading="lazy" width="112" height="144" /> : <span aria-hidden="true">✳</span>}
        </div>
        <div className="customer-order-content">
          <span className="customer-order-reference">{order.reference}</span>
          <span className="customer-order-created">Đặt {historyDate(order.created_at)}</span>
          <h3>{historyItemTitle(order)}</h3>
          <p className="customer-order-recipient">Gửi đến {order.recipient_name || "người nhận"}</p>
          <div className="customer-order-schedule">
            <span>Giao {historyDate(order.delivery_date, true)}</span>
            <span>{order.delivery_time}</span>
          </div>
          <div className="customer-order-state">
            <span className="status-badge">{orderStatuses[order.status] || "Đang cập nhật"}</span>
            <span>{paymentStatuses[order.payment_status] || "Đang cập nhật thanh toán"}</span>
          </div>
          <p className="customer-order-next">{historyNextStep(order)}</p>
          <div className="customer-order-bottom">
            <strong>{money(order.total)}</strong>
            <span>Chi tiết <span aria-hidden="true">↗</span></span>
          </div>
        </div>
      </button>
    </li>
  );
}

function CustomerHistory({ session, recovery, setRecovery, cart, onReorder }) {
  const ownerId = session.user.id;
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("ALL");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("ALL");
  const [loadedAt, setLoadedAt] = useState(null);
  const mounted = useRef(false);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const passwordRequest = useRef(0);
  const selectedId = useRef(null);
  const loadingList = useRef(false);
  const historyButtons = useRef(new Map());
  const detailBack = useRef(null);
  const returnToOrder = useRef(null);
  const filters = useRef("");
  filters.current = JSON.stringify([view, search, payment]);

  async function load(last = null) {
    if (!mounted.current || loadingList.current) return;
    loadingList.current = true;
    const request = ++listRequest.current;
    setBusy(true);
    setError("");
    try {
      let query = backend.from("gd_orders").select(orderColumns)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(historyPageSize + 1);
      if (last) query = beforeCursor(query, last);
      const rows = await result(query);
      if (!mounted.current || request !== listRequest.current) return;
      setMore(rows.length > historyPageSize);
      setOrders(previous => mergeHistoryPage(last ? previous : [], rows.slice(0, historyPageSize)));
      setLoadedAt(new Date());
    } catch (failure) {
      if (mounted.current && request === listRequest.current) setError(failure.message);
    } finally {
      if (mounted.current && request === listRequest.current) {
        loadingList.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    loadingList.current = false;
    load();
    return () => {
      mounted.current = false;
      loadingList.current = false;
      listRequest.current += 1;
      detailRequest.current += 1;
      passwordRequest.current += 1;
    };
  }, [ownerId]);

  useEffect(() => {
    if (selected) detailBack.current?.focus();
    else if (returnToOrder.current) {
      historyButtons.current.get(returnToOrder.current)?.focus();
      returnToOrder.current = null;
    }
  }, [selected?.id]);

  function closeDetail() {
    detailRequest.current += 1;
    selectedId.current = null;
    setSelected(null);
    setDetailBusy(false);
    setDetailError("");
  }

  async function openDetail(order) {
    const request = ++detailRequest.current;
    const filterAtStart = filters.current;
    selectedId.current = order.id;
    returnToOrder.current = order.id;
    setSelected(order);
    setDetailError("");
    setDetailBusy(true);
    try {
      const fresh = await result(backend.from("gd_orders").select(orderColumns)
        .eq("owner_id", ownerId).eq("id", order.id).single());
      if (!mounted.current || request !== detailRequest.current || filterAtStart !== filters.current || selectedId.current !== order.id) return;
      setSelected(fresh);
      setOrders(previous => previous.map(row => row.id === fresh.id ? fresh : row));
    } catch (failure) {
      if (mounted.current && request === detailRequest.current && selectedId.current === order.id) setDetailError(failure.message);
    } finally {
      if (mounted.current && request === detailRequest.current) setDetailBusy(false);
    }
  }

  async function password(event) {
    event.preventDefault();
    if (passwordBusy) return;
    const request = ++passwordRequest.current;
    const value = new FormData(event.currentTarget).get("password");
    setPasswordBusy(true);
    setPasswordError("");
    setNotice("");
    try {
      const response = await backend.auth.updateUser({ password: value, data: { gd_needs_password: false } });
      if (!mounted.current || request !== passwordRequest.current) return;
      if (response.error) setPasswordError(authErrorMessage(response.error));
      else {
        setRecovery(false);
        setNotice("Mật khẩu đã cập nhật.");
      }
    } catch (failure) {
      if (mounted.current && request === passwordRequest.current) setPasswordError(authErrorMessage(failure));
    } finally {
      if (mounted.current && request === passwordRequest.current) setPasswordBusy(false);
    }
  }

  const summary = historySummary(orders);
  const shown = filterHistory(orders, { view, search, payment });
  const hasFilters = view !== "ALL" || search.trim() || payment !== "ALL";
  const atLimit = orders.length >= historyLimit;
  const incomplete = more;
  function resetFilters() {
    setView("ALL");
    setSearch("");
    setPayment("ALL");
  }

  return (
    <>
      <div className="portal-title">
        <span className="eyebrow">YOUR LITTLE CORNER</span>
        <h1>Những bó hoa.<br /><em>Những lời thương.</em></h1>
        <p>Lịch sử mua hoa được giữ riêng cho bạn. Theo dõi bó hoa, xem lại lời nhắn và tự chọn kỉ niệm muốn chia sẻ.</p>
      </div>
      {session.user.is_anonymous && <GuestAccount />}
      {(recovery || (!session.user.is_anonymous && session.user.user_metadata?.gd_needs_password)) && (
        <form className="auth-card" onSubmit={password} aria-busy={passwordBusy}>
          <h2>Đặt mật khẩu mới</h2>
          <p>Chọn mật khẩu từ 12 ký tự, khác mật khẩu hiện tại.</p>
          <fieldset disabled={passwordBusy}>
            <label>Mật khẩu mới<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <button className="button primary">{passwordBusy ? "Đang lưu…" : "Lưu mật khẩu"}</button>
          </fieldset>
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        </form>
      )}
      {notice && <p role="status" className="portal-notice">{notice}</p>}
      {selected ? (
        <section className="customer-history-detail" aria-label={`Đơn ${selected.reference}`}>
          <div className="customer-detail-tools">
            <button ref={detailBack} type="button" className="text-button back-link" onClick={closeDetail}>← Trở lại lịch sử mua</button>
            <button type="button" className="button outline" disabled={detailBusy} onClick={() => openDetail(selected)}>{detailBusy ? "Đang cập nhật…" : "Cập nhật tiến trình"}</button>
          </div>
          {detailBusy && <p role="status" className="customer-history-scope">Đang lấy tiến trình mới nhất từ shop…</p>}
          {detailError && <div className="customer-history-error" role="alert"><p>{detailError}</p><p>Thông tin dưới đây là lần tải trước. Dùng “Cập nhật tiến trình” để thử lại.</p></div>}
          <OrderDetail key={selected.id} order={selected} onUpdated={fresh => {
            if (!mounted.current || selectedId.current !== fresh.id) return;
            setSelected(fresh);
            setOrders(previous => previous.map(row => row.id === fresh.id ? fresh : row));
          }} />
          <ReorderFlowers key={`reorder-${selected.id}`} order={selected} cart={cart} onReorder={onReorder} />
        </section>
      ) : (
        <section className="customer-history" aria-labelledby="customer-history-title" aria-busy={busy}>
          <div className="portal-section-heading customer-history-heading">
            <div><h2 id="customer-history-title">Lịch sử mua hoa</h2><p>{loadedAt ? `Cập nhật lúc ${new Intl.DateTimeFormat("vi-VN", { timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(loadedAt)}` : "Đơn của bạn sẽ được lấy từ cửa hàng."}</p></div>
            <button type="button" className="button outline" disabled={busy} onClick={() => load()}>Làm mới lịch sử</button>
          </div>
          {!!orders.length && <>
            <dl className="customer-history-summary" aria-label="Tóm tắt các đơn đã tải">
              <div><dt>Đơn đã tải</dt><dd>{summary.loaded}</dd></div>
              <div><dt>Đang thực hiện</dt><dd>{summary.active}</dd></div>
              <div><dt>Chờ chuyển khoản</dt><dd>{summary.transfer}</dd></div>
              <div><dt>Đã giao & nhận tiền</dt><dd>{summary.memories}</dd></div>
            </dl>
          </>}
          <p id="history-scope" className="customer-history-scope">Bộ lọc và số liệu chỉ tính {orders.length} đơn đã tải{incomplete ? "; lịch sử còn những đơn cũ hơn" : ""}. Chỉ thông điệp bạn đồng ý chia sẻ mới được công khai.</p>
          {(orders.length > 0 || hasFilters) && (
            <div className="customer-history-filters">
              <fieldset className="customer-history-views">
                <legend className="customer-history-sr">Nhóm đơn hoa</legend>
                {historyViews.map(option => <label key={option.id} className={view === option.id ? "is-selected" : ""}>
                  <input type="radio" name="history-view" value={option.id} checked={view === option.id} onChange={() => { closeDetail(); setView(option.id); }} />
                  <span>{option.name}</span><span className="customer-history-count">{summary[option.id === "ALL" ? "loaded" : option.id.toLowerCase()]}</span>
                </label>)}
              </fieldset>
              <div className="customer-history-search-row">
                <label className="customer-history-search">Tìm trong đơn đã tải<input type="search" value={search} maxLength={100} onChange={event => { closeDetail(); setSearch(event.target.value); }} placeholder="Mã đơn, tên hoa hoặc người nhận" aria-describedby="history-scope" /></label>
                <label>Thanh toán<BloomSelect value={payment} onChange={event => { closeDetail(); setPayment(event.target.value); }}>
                  <option value="ALL">Mọi trạng thái tiền</option>
                  {Object.entries(paymentStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </BloomSelect></label>
                {hasFilters && <button type="button" className="text-button" onClick={resetFilters}>Xóa bộ lọc</button>}
              </div>
            </div>
          )}
          {error && <div className="customer-history-error" role="alert"><p>{error}</p><button type="button" className="text-button" disabled={busy} onClick={() => load()}>Thử tải lại từ đầu</button>{orders.length > 0 && <p>Các đơn đang hiển thị vẫn là dữ liệu lần tải trước.</p>}</div>}
          {busy && <BloomLoader compact={orders.length > 0} label="Những bó hoa của bạn" />}
          {!busy && !orders.length && !error && <div className="portal-empty customer-history-empty"><span aria-hidden="true">✳</span><h3>Câu chuyện đầu tiên đang chờ bạn.</h3><p>Khi đặt hoa, đơn xuất hiện ở đây cùng tiến trình giao và lời nhắn trên thiệp.</p><a className="button outline" href="/#collection">Chọn một bó hoa</a></div>}
          {!!orders.length && !shown.length && <div className="portal-empty customer-history-empty"><h3>Chưa có đơn phù hợp trong phần đã tải.</h3><p>Thử tên hoa khác hoặc xóa bộ lọc{incomplete ? ", rồi tải thêm những đơn cũ hơn bên dưới" : ""}.</p><button type="button" className="button outline" onClick={resetFilters}>Xem các đơn đã tải</button></div>}
          {!!shown.length && <>
            <p className="customer-history-result" role="status">Hiển thị {shown.length} / {orders.length} đơn đã tải.</p>
            <ul className="customer-history-list">
              {shown.map(order => <HistoryCard key={order.id} order={order} onOpen={openDetail} buttonRef={element => {
                if (element) historyButtons.current.set(order.id, element);
                else historyButtons.current.delete(order.id);
              }} />)}
            </ul>
          </>}
          {more && !atLimit && <div className="customer-history-pagination"><button type="button" className="button outline" disabled={busy} onClick={() => load(orders.at(-1))}>Xem thêm những lần mua trước</button><p>Mỗi lần tải tối đa {historyPageSize} đơn. Bộ lọc đang chọn áp dụng cả những đơn vừa tải.</p></div>}
          {atLimit && more && <p className="customer-history-scope">Đã tải {historyLimit} đơn gần nhất trong phiên này. Các đơn cũ hơn vẫn được giữ tại cửa hàng; tìm kiếm ở đây chưa bao gồm những đơn đó.</p>}
        </section>
      )}
    </>
  );
}

export default function CustomerPortal({ cart = [], onReorder }) {
  const { session, recovery, setRecovery } = useStore();
  if (!session) return <AuthPanel />;
  return <CustomerHistory key={session.user.id} session={session} recovery={recovery} setRecovery={setRecovery} cart={cart} onReorder={onReorder} />;
}
