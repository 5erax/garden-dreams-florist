import { useEffect, useState } from "react";
import {
  backend,
  result,
  orderColumns,
  orderStatuses,
  paymentStatuses,
} from "./backend.js";
import { useStore } from "./Store.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import OrderDetail from "./OrderDetail.jsx";
import { money } from "./catalog.js";
import { beforeCursor } from "./cursor.js";
import GuestAccount from "./GuestAccount.jsx";
export default function CustomerPortal() {
  const { session, recovery, setRecovery } = useStore();
  const [orders, setOrders] = useState([]),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [notice, setNotice] = useState("");
  async function load(append = false) {
    setBusy(true);
    setError("");
    try {
      let query = backend
        .from("gd_orders")
        .select(orderColumns)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(21);
      if (append) query = beforeCursor(query, orders.at(-1));
      const rows = await result(query);
      setMore(rows.length > 20);
      setOrders((old) =>
        append ? [...old, ...rows.slice(0, 20)] : rows.slice(0, 20),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setOrders([]);
    setSelected(null);
    if (session) load();
  }, [session?.user.id]);
  if (!session) return <AuthPanel />;
  async function password(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const value = new FormData(event.currentTarget).get("password");
    const { error } = await backend.auth.updateUser({ password: value, data: { gd_needs_password: false } });
    if (error) setError("Chưa thay đổi được mật khẩu. Hãy thử lại.");
    else {
      setRecovery(false);
      setNotice("Mật khẩu đã cập nhật.");
    }
    setBusy(false);
  }
  return (
    <>
      <div className="portal-title">
        <span className="eyebrow">YOUR LITTLE CORNER</span>
        <h1>
          Những bó hoa.
          <br />
          <em>Những lời thương.</em>
        </h1>
        <p>
          Lịch sử mua hoa của bạn được giữ riêng. Chỉ bạn chọn lời nào sẽ được
          chia sẻ.
        </p>
      </div>
      {session.user.is_anonymous && <GuestAccount />}
      {(recovery || (!session.user.is_anonymous && session.user.user_metadata?.gd_needs_password)) && (
        <form className="auth-card" onSubmit={password}>
          <h2>Đặt mật khẩu mới</h2>
          <label>
            Mật khẩu mới
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button className="button primary" disabled={busy}>
            Lưu mật khẩu
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="portal-notice">
          {notice}
        </p>
      )}
      {selected ? (
        <>
          <button
            className="text-button back-link"
            onClick={() => setSelected(null)}
          >
            ← Trở lại lịch sử mua
          </button>
          <OrderDetail order={selected} onUpdated={setSelected} />
          <button
            className="button outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setSelected(
                  await result(
                    backend
                      .from("gd_orders")
                      .select(orderColumns)
                      .eq("id", selected.id)
                      .single(),
                  ),
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Cập nhật tiến trình
          </button>
        </>
      ) : (
        <>
          <div className="portal-section-heading">
            <h2>Lịch sử mua hoa</h2>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => load()}
            >
              Tải lại
            </button>
          </div>
          {!busy && !orders.length && !error && (
            <div className="portal-empty">
              <h3>Câu chuyện đầu tiên đang chờ bạn.</h3>
              <p>
                Khi đặt hoa, đơn sẽ xuất hiện ở đây cùng tiến trình giao và lời
                nhắn trên thiệp.
              </p>
              <a className="button outline" href="#collection">
                Chọn một bó hoa
              </a>
            </div>
          )}
          <div className="history-grid">
            {orders.map((order) => (
              <button
                className="history-card"
                key={order.id}
                onClick={() => setSelected(order)}
              >
                <img src={order.items[0].image} alt={order.items[0].name} />
                <div>
                  <span className="eyebrow">{order.reference}</span>
                  <h3>{order.items.map((i) => `${i.name}${i.sizeName ? ` · ${i.sizeName}` : ""}`).join(", ")}</h3>
                  <p>
                    {new Intl.DateTimeFormat("vi-VN").format(
                      new Date(order.created_at),
                    )}{" "}
                    · {money(order.total)}
                  </p>
                  <span className="status-badge">
                    {orderStatuses[order.status]}
                  </span>
                  <small>{paymentStatuses[order.payment_status]}</small>
                  {order.status === "DELIVERED" &&
                    order.payment_status === "PAID" && (
                      <p className="memory-hint">
                        ✳ Một dấu hoa · xem & chia sẻ lời nhắn
                      </p>
                    )}
                </div>
              </button>
            ))}
          </div>
          {more && (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => load(true)}
            >
              Xem những lần mua trước
            </button>
          )}
        </>
      )}
      {busy && <p role="status">Đang tải góc của bạn…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
