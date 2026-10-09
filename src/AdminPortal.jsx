import { useEffect, useState } from "react";
import { backend, result, orderColumns, orderStatuses } from "./backend.js";
import { useStore } from "./Store.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import { beforeCursor } from "./cursor.js";
import OrderDetail from "./OrderDetail.jsx";
import { money, occasions } from "./catalog.js";
import ProductPhotosEditor from "./ProductPhotosEditor.jsx";

const newProduct = {
  name: "",
  occasion: "Sinh nhật",
  price: 390000,
  stems: "",
  description: "",
  image: "/flowers/bouquet_1.webp",
  images: [],
  active: true,
  featured: false,
};
const newShipping = { name: "", area: "", fee: 0, active: false };
export default function AdminPortal() {
  const store = useStore();
  const [tab, setTab] = useState("orders"),
    [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState(null),
    [selected, setSelected] = useState(null),
    [more, setMore] = useState(false),
    [filter, setFilter] = useState("");
  async function load(append = false) {
    if (!store.isAdmin) return;
    setBusy(true);
    setError("");
    try {
      if (tab === "shop") {
        setRows([
          await result(
            backend.from("gd_shop").select("*").eq("id", 1).single(),
          ),
        ]);
        return;
      }
      let query = backend
        .from("gd_" + tab)
        .select(tab === "orders" ? orderColumns : "*");
      if (tab === "orders") {
        query = query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(31);
        if (filter) query = query.eq("status", filter);
        if (append) query = beforeCursor(query, rows.at(-1));
      } else query = query.order(tab === "products" ? "id" : "name");
      const data = await result(query);
      setMore(tab === "orders" && data.length > 30);
      setRows((old) =>
        append
          ? [...old, ...data.slice(0, 30)]
          : tab === "orders"
            ? data.slice(0, 30)
            : data,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setRows([]);
    setEdit(null);
    setSelected(null);
    setNotice("");
    if (store.isAdmin) load();
  }, [tab, filter, store.isAdmin]);
  if (!store.session) return <AuthPanel />;
  if (!store.isAdmin)
    return (
      <div className="portal-empty">
        <h1>
          Góc của
          <br />
          <em>người chăm hoa.</em>
        </h1>
        <p>
          Tài khoản này chưa có quyền admin. Quyền được cấp từ database, không
          thể tự bật bằng đăng ký hay trình duyệt.
        </p>
        <a href="#account" className="button outline">
          Về góc của tôi
        </a>
      </div>
    );
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const f = Object.fromEntries(new FormData(event.currentTarget));
    try {
      let fields;
      if (tab === "products")
        fields = {
          name: f.name.trim(),
          occasion: f.occasion,
          price: Number(f.price),
          stems: f.stems.trim(),
          description: f.description.trim(),
          image: f.image.trim(),
          active: f.active === "on",
          featured: f.featured === "on",
          ...(store.features.productAlbum ? { images: edit.images || [] } : {}),
        };
      if (tab === "shipping")
        fields = {
          name: f.name.trim(),
          area: f.area.trim(),
          fee: Number(f.fee),
          active: f.active === "on",
        };
      if (tab === "shop")
        fields = {
          name: f.name.trim(),
          phone: f.phone.replace(/[\s().-]/g, ""),
          about: f.about.trim(),
          accepting_orders: f.accepting_orders === "on",
          cod_enabled: f.cod_enabled === "on",
          transfer_enabled: f.transfer_enabled === "on",
          bank_bin: f.bank_bin.trim(),
          bank_account: f.bank_account.trim(),
          bank_name: f.bank_name.trim(),
          account_name: f.account_name.trim(),
        };
      const table = tab === "shop" ? "gd_shop" : "gd_" + tab;
      let row;
      if (edit?.id || tab === "shop") {
        const old = tab === "shop" ? rows[0] : edit;
        row = await result(
          backend
            .from(table)
            .update(fields)
            .eq("id", old.id)
            .eq("version", old.version)
            .select("*")
            .maybeSingle(),
        );
        if (!row)
          throw new Error("Dữ liệu đã thay đổi. Tải lại trước khi cập nhật.");
      } else
        row = await result(
          backend.from(table).insert(fields).select("*").single(),
        );
      setEdit(null);
      await load();
      await store.refresh();
      setNotice("Đã lưu cấu hình vào database.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const item = tab === "shop" ? rows[0] : edit;
  return (
    <>
      <div className="portal-title">
        <span className="eyebrow">THE FLORIST DESK</span>
        <h1>
          Một cửa hàng.
          <br />
          <em>Cả một khu vườn.</em>
        </h1>
        <p>
          Quản lý hoa, giao nhận, phương thức thanh toán và từng lời thương.
        </p>
      </div>
      <nav className="admin-tabs" aria-label="Phần quản trị">
        {[
          ["orders", "Đơn hoa"],
          ["products", "Bộ sưu tập"],
          ["shipping", "Giao hoa"],
          ["shop", "Cửa hàng & thanh toán"],
        ].map(([key, name]) => (
          <button
            key={key}
            disabled={busy}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="portal-section-heading">
        <h2>
          {tab === "orders"
            ? "Đơn hoa"
            : tab === "products"
              ? "Bộ sưu tập"
              : tab === "shipping"
                ? "Dịch vụ giao hoa"
                : "Thông tin cửa hàng"}
        </h2>
        <div>
          {tab === "orders" && (
            <label className="inline-label">
              Trạng thái
              <select
                disabled={busy}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(orderStatuses).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => load()}
          >
            Tải lại
          </button>
          {["products", "shipping"].includes(tab) && (
            <button
              className="button outline"
              disabled={busy}
              onClick={() =>
                setEdit(
                  tab === "products" ? { ...newProduct } : { ...newShipping },
                )
              }
            >
              Thêm {tab === "products" ? "hoa" : "dịch vụ"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="portal-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Đang xử lý…</p>}
      {tab === "orders" &&
        (selected ? (
          <>
            <button
              className="text-button back-link"
              onClick={() => setSelected(null)}
            >
              ← Danh sách đơn
            </button>
            <OrderDetail
              order={selected}
              admin
              onUpdated={(next) => {
                setSelected(next);
                setRows((old) =>
                  old.map((row) => (row.id === next.id ? next : row)),
                );
              }}
            />
          </>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Người nhận</th>
                    <th>Ngày giao</th>
                    <th>Tổng</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.reference}</td>
                      <td>{row.recipient_name || "Đã xóa thông tin"}</td>
                      <td>{row.delivery_date}</td>
                      <td>{money(row.total)}</td>
                      <td>
                        {orderStatuses[row.status]}
                        <br />
                        <small>
                          {row.payment_status === "PAID"
                            ? "Đã nhận tiền"
                            : row.payment_status === "REFUNDED"
                              ? "Đã hoàn"
                              : "Chưa nhận tiền"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelected(row)}
                        >
                          Xem & xử lý
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && !busy && <p>Chưa có đơn phù hợp.</p>}
            {more && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() => load(true)}
              >
                Tải thêm đơn
              </button>
            )}
          </>
        ))}
      {["products", "shipping"].includes(tab) && !edit && (
        <div className="admin-items">
          {rows.map((row) => (
            <article key={row.id}>
              {tab === "products" && <img src={row.image} alt={row.name} />}
              <div>
                <h3>{row.name}</h3>
                <p>{tab === "products" ? row.stems : row.area}</p>
                <strong>
                  {money(tab === "products" ? row.price : row.fee)}
                </strong>
                <small>{row.active ? "Đang bật" : "Đã tắt"}</small>
              </div>
              <button className="button outline" disabled={busy} onClick={() => setEdit(
                tab === "products" && store.features.productAlbum ? { ...row, images: row.images || [] } : row,
              )}>
                Chỉnh sửa
              </button>
            </article>
          ))}
        </div>
      )}
      {item && tab !== "orders" && (
        <form
          key={tab + "-" + (item.id || "new") + "-" + (item.version || 0)}
          className="admin-edit-form"
          onSubmit={save}
        >
          <fieldset disabled={busy}>
            {tab === "products" && (
              <>
                <h3>{edit.id ? "Chỉnh sửa bó hoa" : "Thêm bó hoa"}</h3>
                <div className="form-grid">
                  <label>
                    Tên hoa
                    <input
                      name="name"
                      defaultValue={item.name}
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Dịp tặng
                    <select name="occasion" defaultValue={item.occasion}>
                      {occasions.slice(1).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Giá VNĐ
                    <input
                      name="price"
                      type="number"
                      step="1"
                      min="1000"
                      max="100000000"
                      defaultValue={item.price}
                      required
                    />
                  </label>
                  <label>
                    Hoa trong bó
                    <input
                      name="stems"
                      maxLength={200}
                      defaultValue={item.stems}
                      required
                    />
                  </label>
                </div>
                <label>
                  Mô tả
                  <textarea
                    name="description"
                    maxLength={1000}
                    defaultValue={item.description}
                  />
                </label>
                <label>
                  {item.images?.length ? "Ảnh bìa (ảnh đầu album)" : "Ảnh bìa dự phòng (đường dẫn /flowers/ hoặc URL HTTPS)"}
                  <input
                    name="image"
                    maxLength={500}
                    value={item.images?.[0] || item.image}
                    readOnly={Boolean(item.images?.length)}
                    onChange={(e) => setEdit(old => ({ ...old, image: e.target.value }))}
                    required
                  />
                </label>
                {store.features.productAlbum && <ProductPhotosEditor
                  images={item.images || []}
                  onChange={(images) => setEdit(old => ({ ...old, images }))}
                  onBusyChange={setBusy}
                />}
                <label className="check-label">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={item.active}
                  />
                  Cho phép khách đặt bó hoa này
                </label>
                <label className="check-label">
                  <input
                    name="featured"
                    type="checkbox"
                    defaultChecked={item.featured}
                  />
                  Đánh dấu được yêu thích
                </label>
              </>
            )}
            {tab === "shipping" && (
              <>
                <h3>{edit.id ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ giao"}</h3>
                <label>
                  Tên dịch vụ
                  <input
                    name="name"
                    minLength={2}
                    maxLength={80}
                    defaultValue={item.name}
                    required
                  />
                </label>
                <label>
                  Khu vực áp dụng
                  <input
                    name="area"
                    minLength={2}
                    maxLength={200}
                    defaultValue={item.area}
                    required
                  />
                </label>
                <label>
                  Phí giao VNĐ
                  <input
                    name="fee"
                    type="number"
                    min="0"
                    max="10000000"
                    step="1"
                    defaultValue={item.fee}
                    required
                  />
                </label>
                <label className="check-label">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={item.active}
                  />
                  Bật dịch vụ
                </label>
                <p className="fineprint">
                  Khách chọn dịch vụ theo khu vực được mô tả. Admin cần kiểm tra
                  địa chỉ thực tế trước khi xác nhận; chưa tự gọi hãng vận
                  chuyển.
                </p>
              </>
            )}
            {tab === "shop" && (
              <>
                <div className="form-grid">
                  <label>
                    Tên cửa hàng
                    <input
                      name="name"
                      minLength={2}
                      maxLength={80}
                      defaultValue={item.name}
                      required
                    />
                  </label>
                  <label>
                    Số điện thoại / Zalo
                    <input
                      name="phone"
                      type="tel"
                      maxLength={20}
                      defaultValue={item.phone}
                      required
                    />
                  </label>
                </div>
                <label>
                  Giới thiệu
                  <textarea
                    name="about"
                    maxLength={1000}
                    defaultValue={item.about}
                  />
                </label>
                <label className="check-label">
                  <input
                    name="accepting_orders"
                    type="checkbox"
                    defaultChecked={item.accepting_orders}
                  />
                  Mở nhận yêu cầu đặt hoa thật
                </label>
                <h3>Thanh toán</h3>
                <label className="check-label">
                  <input
                    name="cod_enabled"
                    type="checkbox"
                    defaultChecked={item.cod_enabled}
                  />
                  COD — thanh toán khi nhận
                </label>
                <label className="check-label">
                  <input
                    name="transfer_enabled"
                    type="checkbox"
                    defaultChecked={item.transfer_enabled}
                  />
                  Chuyển khoản VietQR
                </label>
                <div className="form-grid">
                  <label>
                    Tên ngân hàng
                    <input
                      name="bank_name"
                      maxLength={80}
                      defaultValue={item.bank_name}
                    />
                  </label>
                  <label>
                    Mã BIN ngân hàng (6 số)
                    <input
                      name="bank_bin"
                      pattern="[0-9]{6}|^$"
                      maxLength={6}
                      defaultValue={item.bank_bin}
                    />
                  </label>
                  <label>
                    Số tài khoản nhận tiền
                    <input
                      name="bank_account"
                      maxLength={32}
                      defaultValue={item.bank_account}
                    />
                  </label>
                  <label>
                    Tên chủ tài khoản
                    <input
                      name="account_name"
                      maxLength={100}
                      defaultValue={item.account_name}
                    />
                  </label>
                </div>
                <p className="fineprint">
                  Cấu hình ngân hàng là thông tin nhận chuyển khoản, được hiển
                  thị cho khách. Không nhập mật khẩu ngân hàng hay API secret.
                  Đơn cũ giữ thông tin nhận tiền tại thời điểm đặt.
                </p>
              </>
            )}
            <div className="form-actions">
              <button className="button primary">
                Lưu {tab === "shop" ? "cửa hàng" : "thay đổi"}
              </button>
              {edit && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setEdit(null)}
                >
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      <p className="fineprint">
        Quyền được kiểm tra trong database cho mọi thao tác. Giá và phí mới chỉ
        áp dụng cho đơn đặt sau khi lưu.
      </p>
    </>
  );
}
