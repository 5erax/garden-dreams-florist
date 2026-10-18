import AdminNavigation from './AdminNavigation.jsx';
import { useUnsavedForms, markFormSaved } from './unsaved-forms.js';
import ShopPolicy from './ShopPolicy.jsx';
import BloomTime from './BloomTime.jsx';
import BloomMoney from "./BloomMoney.jsx";
import BloomDate from "./BloomDate.jsx";
import AdminCatalogTable from "./AdminCatalogTable.jsx";
import { call } from "./backend.js";
import BankSettings from "./BankSettings.jsx";
import AdminMemories from "./AdminMemories.jsx";
import { formatDate, downloadCsv } from "./admin-ux.js";
import BloomSelect from "./BloomSelect.jsx";
import { useEffect, useState, useRef } from "react";
import { backend, result, orderColumns, orderStatuses, paymentStatuses } from "./backend.js";
import { useStore } from "./Store.jsx";
import { AuthPanel } from "./PortalShell.jsx";
import { beforeCursor } from "./cursor.js";
import OrderDetail from "./OrderDetail.jsx";
import { money, occasions } from "./catalog.js";
import ProductPhotosEditor from "./ProductPhotosEditor.jsx";
import AdminVariants from "./AdminVariants.jsx";
import AdminDelivery from "./AdminDelivery.jsx";
import OperationsDesk from "./OperationsDesk.jsx";
import ReconciliationDesk from "./ReconciliationDesk.jsx";
import AdminInventory from './AdminInventory.jsx';
import BusinessDashboard from './BusinessDashboard.jsx';
import { readAdminTab } from './admin-navigation.js';
import shopPhotoSources from './shop-photo-sources.json' with { type: 'json' };

const newProduct = {
  name: "",
  occasion: "Sinh nhật",
  price: "",
  stems: "",
  description: "",
  specification: "",
  image: "",
  images: [],
  active: false,
  featured: false,
};
const newShipping = { name: "", area: "", fee: "", active: false };
export default function AdminPortal() {
  const store = useStore();
  return <AdminWorkspace key={`${store.session?.user.id || "signed-out"}:${Boolean(store.isAdmin)}:${Boolean(store.connected)}`} store={store} />;
}
function AdminWorkspace({ store }) {
  const workspace = useRef(null);
  const {confirmDiscard,hasChanges} = useUnsavedForms(workspace);
  const [tab, setTab] = useState(() => {
    try { return readAdminTab(store.session?.user.id, store.features, globalThis.sessionStorage); }
    catch { return 'orders'; }
  }),
    [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState(null),
    [selected, setSelected] = useState(null),
    [more, setMore] = useState(false),
    [filter, setFilter] = useState("");
  const [deskQueue,setDeskQueue]=useState('ALL');
  const requestedEdit=useRef(null), requestSequence=useRef(0);
  const [search,setSearch]=useState('');
  function changeTab(next) {
    if (next === tab) return;
    if (!confirmDiscard()) return;
    // Clear the old section before rendering the next table or form.
    requestSequence.current++;
    setRows([]); setEdit(null); setSelected(null); setMore(false);
    setError(''); setNotice(''); setTab(next);
  }
  useEffect(() => {
    if (store.isAdmin && store.connected) {
      try { sessionStorage.setItem(`gd-admin-tab:${store.session.user.id}`, tab); } catch {}
    }
  }, [tab, store.isAdmin, store.connected, store.session?.user.id]);
  async function load(append = false) {
    if (!store.isAdmin) return;
    if (["dashboard", "calendar", "desk", "reconciliation", "inventory", "memories"].includes(tab)) return;
    const request=++requestSequence.current;
    setBusy(true);
    setError("");
    try {
      if (tab === "shop") {
        const shop=await result(backend.from("gd_shop").select("*").eq("id",1).single());
        if(request===requestSequence.current)setRows([shop]);
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
        if(search)query=query.ilike('reference',search.toUpperCase().replace(/[^A-Z0-9-]/g,'')+'%');
        if (append) query = beforeCursor(query, rows.at(-1));
      } else query = query.order(tab === "products" ? "sort_order" : "fee").order("id");
      const data = await result(query);
      if(request!==requestSequence.current)return;
      if(tab==='products' && requestedEdit.current){setEdit(data.find(row=>row.id===requestedEdit.current)||null);requestedEdit.current=null;}
      setMore(tab === "orders" && data.length > 30);
      setRows((old) =>
        append
          ? [...old, ...data.slice(0, 30)]
          : tab === "orders"
            ? data.slice(0, 30)
            : data,
      );
    } catch (e) {
      if(request===requestSequence.current)setError(e.message);
    } finally {
      if(request===requestSequence.current)setBusy(false);
    }
  }
  useEffect(() => {
    setRows([]);
    setEdit(null);
    setSelected(null);
    setNotice("");
    if (store.isAdmin) load();
    return()=>{requestSequence.current++;};
  }, [tab, filter, search, store.isAdmin]);
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
          Tài khoản này chưa có quyền admin. Quyền do chủ cửa hàng cấp, không
          thể tự bật bằng đăng ký hay trình duyệt.
        </p>
        <a href="#account" className="button outline">
          Về góc của tôi
        </a>
      </div>
    );
  async function save(event) {
    event.preventDefault();
    const savedForm = event.currentTarget;
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
          slug: f.slug.trim(),
          occasions: new FormData(event.currentTarget).getAll('occasions'),
          image_alts: edit.image_alts || {},
          price: Number(f.price),
          stems: f.stems.trim(),
          description: f.description.trim(),
          ...(store.features.bouquetSpecifications ? {specification:f.specification.trim()} : {}),
          image: f.image.trim() || "/flowers/flower-pending.svg",
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
          ...(Object.hasOwn(rows[0], "address") ? { address: f.address.trim() } : {}),
          accepting_orders: f.accepting_orders === "on",
          cod_enabled: f.cod_enabled === "on",
          transfer_enabled: f.transfer_enabled === "on",
          bank_bin: f.bank_bin.trim(),
          bank_account: f.bank_account.trim(),
          bank_name: f.bank_name.trim(),
          account_name: f.account_name.trim(),
          opens_at:f.opens_at,closes_at:f.closes_at,closed_message:f.closed_message.trim(),reopens_on:f.reopens_on||null,returns_policy:f.returns_policy.trim(),legal_name:f.legal_name.trim(),registration_number:f.registration_number.trim(),
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
      markFormSaved(savedForm);
      setEdit(null);
      await load();
      await store.refresh();
      setNotice("Đã lưu cấu hình cửa hàng.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function patch(row,fields,refresh=true) {
    const changed=await result(backend.from('gd_'+tab).update(fields).eq('id',row.id).eq('version',row.version).select('*').maybeSingle());
    if(!changed)throw Error('Dữ liệu đã đổi. Tải lại trước khi sửa.');
    if(refresh){await load();await store.refresh();}
  }
  async function quickPatch(row,fields){if(busy)return;setBusy(true);setError('');try{await patch(row,fields);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function bulk(ids,active){if(busy)return;setBusy(true);setError('');let done=0;try{for(const row of rows.filter(row=>ids.includes(row.id))){await patch(row,{active},false);done++;}setNotice('Đã cập nhật '+done+' mẫu.');}catch(e){setError('Đã lưu '+done+' mẫu; dừng ở mẫu lỗi. '+e.message);}finally{await load();await store.refresh();setBusy(false);}}
  const item = tab === "shop" ? rows[0] : edit;
  const photoSource = tab === 'products' && item?.image?.endsWith('-pending.svg') && !item.images?.length ? shopPhotoSources[item.name] : null;
  return (
    <div ref={workspace} className="admin-workspace">
      {hasChanges && <p className="unsaved-notice" role="status">Bạn có chỉnh sửa chưa lưu.</p>}
      <div className="portal-title">
        <span className="eyebrow">BÀN CHĂM CỬA HÀNG</span>
        <h1>
          Quản lý cửa hàng
        </h1>
        <p>
          Theo dõi đơn, hoa, lịch giao và tiền thu.
        </p>
      </div>
      <AdminNavigation tab={tab} features={store.features} busy={busy} onChange={changeTab} />
      <div className="admin-content">
      {tab === "memories" ? <AdminMemories /> : tab === "dashboard" ? <BusinessDashboard onNavigate={(next,id)=>{requestedEdit.current=typeof id==='number'?id:null;if(next==='desk')setDeskQueue(id==='OVERDUE'?'OVERDUE':'ALL');changeTab(next);}} /> : tab === "inventory" ? <AdminInventory /> : tab === "calendar" ? <AdminDelivery /> : tab === "desk" ? <OperationsDesk initialQueue={deskQueue} /> : tab === "reconciliation" ? <ReconciliationDesk /> : <>
      {!selected && <div className="portal-section-heading">
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
          {tab === "orders" && <label>Tìm mã đơn<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="GD-…" maxLength={40}/></label>}
          {tab === "orders" && (
            <label className="inline-label">
              Trạng thái
              <BloomSelect
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
              </BloomSelect>
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
      }
      {error && !item && (
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
              <table className="admin-orders-table" role="table" aria-label="Danh sách đơn hoa">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Người nhận</th>
                    <th>Ngày giao</th>
                    <th>Khu vực</th><th>Thanh toán</th><th>Tổng</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Mã đơn">{row.reference}</td>
                      <td data-label="Người nhận">{row.recipient_name || "Đã xóa thông tin"}</td>
                      <td data-label="Ngày giao">{formatDate(row.delivery_date)}</td>
                      <td data-label="Khu vực">{row.shipping?.name}</td><td data-label="Thanh toán">{row.payment_method==='COD'?'COD':'VietQR'}</td><td data-label="Tổng">{money(row.total)}</td>
                      <td data-label="Trạng thái">
                        {orderStatuses[row.status]}
                        <br />
                        <small>
                          {paymentStatuses[row.payment_status]}
                        </small>
                      </td>
                      <td data-label="Thao tác">
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
            <p className="fineprint">Hiển thị {rows.length} đơn; xuất CSV chỉ bao gồm trang đơn này.</p>
            <button className="button outline" disabled={!rows.length || busy} onClick={()=>downloadCsv([['Mã đơn','Ngày giao','Khu vực','Phương thức','Trạng thái','Tổng'],...rows.map(row=>[row.reference,row.delivery_date,row.shipping?.name,row.payment_method,orderStatuses[row.status],row.total])],'garden-dreams-orders.csv')}>Xuất trang đơn này</button>
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
      {tab==='products' && !edit && <AdminCatalogTable rows={rows} busy={busy} onEdit={row=>setEdit({...row,images:row.images||[]})} onPatch={quickPatch} onBulk={bulk} onSlugs={async ids=>{if(busy)return;setBusy(true);try{const amount=await call('gd_generate_product_slugs',{p_ids:ids});setNotice('Đã tạo slug cho '+amount+' mẫu; link mã số cũ vẫn chuyển hướng.');await load();await store.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}} onReorder={async ids=>{setBusy(true);try{await call('gd_reorder_products',{p_ids:ids});await load();await store.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}} />}
      {tab === "shipping" && !edit && (
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
                <button type="button" role="switch" aria-checked={row.active} disabled={busy} className="status-badge" onClick={()=>quickPatch(row,{active:!row.active})}>{row.active ? "Đang hoạt động" : "Ngừng nhận đặt"}</button>
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
                <h4 className="form-section-title">Thông tin cơ bản</h4>
                  {edit.reference_only && <p className="reference-note">Mẫu tham khảo: xác nhận hoa thực tế, ảnh, quy cách và giá trước khi bật nhận đặt. Bật bán sẽ chuyển mẫu này sang danh mục bán chính thức.</p>}
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
                    Dịp hiển thị chính
                    <BloomSelect name="occasion" defaultValue={item.occasion}>
                      {occasions.slice(1).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </BloomSelect>
                  </label>
                  <label>
                    Giá VNĐ
                    <BloomMoney name="price" defaultValue={item.price} min={1000} max={100000000} required/>
                  </label>
                  <label>
                    Hoa trong bó {item.recipe_managed && '· lấy từ công thức tiêu chuẩn'}
                    <input
                      name="stems"
                      readOnly={item.recipe_managed}
                      maxLength={200}
                      defaultValue={item.stems}
                      required
                    />
                  </label>
                </div>
                <label>Đường dẫn riêng (slug)<input name="slug" defaultValue={item.slug || ''} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="ma-hong-bo-hong-phan"/><small>Bỏ trống khi tạo để dùng đường dẫn từ tên bó hoa. Link bo-hoa-ID cũ vẫn chuyển về đường dẫn mới.</small></label>
                <fieldset className="occasion-tags"><legend>Các dịp dùng để lọc</legend>{['Sinh nhật','Tình yêu','Chúc mừng','Cưới hỏi','20/10','8/3','20/11','Khai trương','Chia buồn'].map(name=><label className="check-label" key={name}><input type="checkbox" name="occasions" value={name} defaultChecked={(item.occasions?.length?item.occasions:[item.occasion]).includes(name)}/>{name}</label>)}</fieldset>
                <label>
                  Mô tả
                  <textarea
                    name="description"
                    aria-describedby="product-description-help"
                    maxLength={1000}
                    defaultValue={item.description}
                  />
                </label>
                <p id="product-description-help" className="fineprint">Mô tả loại hoa, sắc hoa và những thông tin shop đã xác nhận; không cần kéo dài cho đủ ký tự.</p>
                <h4 className="form-section-title">Hình ảnh</h4>
                {photoSource && <aside className="photo-source-note" aria-label="Nguồn ảnh tham khảo">
                  <strong>Mẫu này cần ảnh thực tế của shop</strong>
                  <p>{photoSource.note} <a href={photoSource.url} target="_blank" rel="noreferrer">Xem ảnh tại {photoSource.shop}</a></p>
                  <p className="fineprint">Nguồn để tham khảo loại và màu hoa. Dùng ảnh của Garden Dreams hoặc ảnh được chủ nguồn cho phép; không sao chép giá hay quy cách sang mẫu này.</p>
                </aside>}
                <details className="advanced-image"><summary>Ảnh bìa từ đường dẫn · Nâng cao</summary><label>
                  {item.images?.length ? "Ảnh bìa (ảnh đầu album)" : "Ảnh bìa dự phòng (đường dẫn /flowers/ hoặc URL HTTPS)"}
                  <input
                    name="image"
                    maxLength={500}
                    value={item.images?.[0] || item.image}
                    readOnly={Boolean(item.images?.length)}
                    onChange={(e) => setEdit(old => ({ ...old, image: e.target.value }))}
                  />
                </label>
                </details>
                {store.features.productAlbum && <ProductPhotosEditor
                  images={item.images || []}
                  alts={item.image_alts||{}} onAltChange={image_alts=>setEdit(old=>({...old,image_alts}))}
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
                  Mẫu nổi bật
                </label>
              </>
            )}
            {tab === 'products' && store.features.bouquetSpecifications && <label>Quy cách cỡ tiêu chuẩn<textarea name="specification" defaultValue={item.specification || ''} maxLength={1200} rows={4} placeholder="Loại hoa, độ đầy, cách gói và những thông số cửa hàng có thể cam kết." /></label>}
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
                  <BloomMoney name="fee" defaultValue={item.fee} min={0} max={10000000} required/>
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
                <h3 className="form-section-title">Thông tin cửa hàng</h3>
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
                {Object.hasOwn(item, "address") && (
                  <label>
                    Địa chỉ cửa hàng
                    <input name="address" minLength={10} maxLength={300} defaultValue={item.address} required />
                  </label>
                )}
                <label>
                  Giới thiệu
                  <textarea
                    name="about"
                    maxLength={1000}
                    defaultValue={item.about}
                  />
                </label>
                <h3 className="form-section-title">Giờ hoạt động</h3>
                <label className="check-label">
                  <input
                    name="accepting_orders"
                    type="checkbox"
                    defaultChecked={item.accepting_orders}
                  />
                  Đang nhận đơn
                </label>
                <div className="form-grid"><label>Mở cửa<BloomTime name="opens_at" defaultValue={item.opens_at?.slice(0,5)||'08:00'}/></label><label>Đóng cửa<BloomTime name="closes_at" defaultValue={item.closes_at?.slice(0,5)||'17:00'}/></label><label>Ngày dự kiến mở lại<BloomDate name="reopens_on" defaultValue={item.reopens_on||''}/></label><label>Thông báo khi tạm nghỉ<input placeholder="Ví dụ: Shop tạm nghỉ; liên hệ Zalo để được hỗ trợ." name="closed_message" defaultValue={item.closed_message||''} maxLength={500}/></label></div>
                <h3 className="form-section-title">Chính sách & thông tin pháp lý</h3>
                <ShopPolicy key={item.version} value={item.returns_policy||''} /><div className="form-grid"><label>Tên pháp lý (khi đã có)<input name="legal_name" defaultValue={item.legal_name||''} maxLength={200}/></label><label>Mã đăng ký kinh doanh (khi đã có)<input name="registration_number" defaultValue={item.registration_number||''} maxLength={80}/></label></div>
                <h3 className="form-section-title">Thanh toán</h3>
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
                <BankSettings item={item} />
                <p className="fineprint">
                  Cấu hình ngân hàng là thông tin nhận chuyển khoản, được hiển
                  thị cho khách. Không nhập mật khẩu ngân hàng hay API secret.
                  Đơn cũ giữ thông tin nhận tiền tại thời điểm đặt.
                </p>
              </>
            )}
            <div className="form-actions admin-save-bar">
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button primary">
                {tab === "shop" ? "Lưu cửa hàng" : tab === "products" ? edit?.id ? "Lưu bó hoa" : "Tạo bó hoa" : edit?.id ? "Lưu khu vực giao" : "Tạo khu vực giao"}
              </button>
              {edit && (
                <button
                  className="button outline"
                  type="button"
                  data-discard-changes onClick={() => setEdit(null)}
                >
                  Hủy
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {tab === "products" && edit?.id && store.features.productVariants && <AdminVariants
        key={edit.id} specificationsEnabled={store.features.bouquetSpecifications} productId={edit.id} disabled={busy} onBusyChange={setBusy} onSaved={store.refresh}
      />}
      <p className="fineprint">
        Chỉ nhân viên được phân quyền mới thay đổi cấu hình. Giá và phí mới chỉ
        áp dụng cho đơn đặt sau khi lưu.
      </p>
      </>}
      </div>
    </div>
  );
}
