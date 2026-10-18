import { markFormSaved } from './unsaved-forms.js';
import { useEffect, useRef, useState } from "react";
import { backend, result } from "./backend.js";
import { money } from "./catalog.js";

const newVariant = { sku: "", size_name: "", price: 390000, active: true };
export default function AdminVariants({ productId, disabled, onBusyChange, onSaved, specificationsEnabled = false }) {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  async function load() {
    const current = ++request.current;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const data = await result(backend.from("gd_product_variants").select("*").eq("product_id", productId).order("id"));
      if (current === request.current) setRows(data);
    } catch (e) { if (current === request.current) setError(e.message); }
    finally { if (current === request.current) { setBusy(false); onBusyChange(false); } }
  }
  useEffect(() => {
    load();
    return () => { request.current++; onBusyChange(false); };
  }, [productId]);
  async function save(event) {
    event.preventDefault();
    const savedForm = event.currentTarget;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const values = { sku: fields.sku.trim().toUpperCase(), size_name: fields.size_name.trim(), price: Number(fields.price), active: fields.active === "on", ...(specificationsEnabled ? {specification:fields.specification.trim()} : {}) };
    setBusy(true);
    onBusyChange(true);
    setError("");
    setNotice("");
    try {
      const row = edit.id ? await result(backend.from("gd_product_variants").update(values)
        .eq("product_id", productId).eq("id", edit.id).eq("version", edit.version).select("*").maybeSingle()) :
        await result(backend.from("gd_product_variants").insert({ ...values, product_id: productId }).select("*").single());
      if (!row) throw new Error("Cỡ bó đã được sửa ở nơi khác. Tải lại trước khi cập nhật.");
      markFormSaved(savedForm);
      setEdit(null);
      await onSaved();
      await load();
      setNotice("Đã lưu cỡ bó. Đơn đã đặt giữ tên và giá cũ.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <section className="admin-edit-form" aria-label="Các cỡ bó hoa">
    <h3>Các cỡ bó hoa</h3>
    <p className="fineprint">Giá trên sản phẩm là cỡ Tiêu chuẩn. Thêm cỡ khác tại đây; tắt cỡ chỉ ngừng các đơn đặt mới.</p>
    <div className="form-actions">
      <button className="button outline" disabled={busy || disabled} data-discard-changes onClick={() => { setEdit({ ...newVariant }); setNotice(""); }}>Thêm cỡ bó</button>
      <button className="text-button" disabled={busy || disabled} data-discard-changes onClick={() => { setEdit(null); load(); }}>Tải lại cỡ bó</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <ul className="variant-list">
      {rows.map(row => <li key={row.id}>
        <div><strong>{row.size_name}</strong><p>{row.sku} · {money(row.price)} · {row.active ? "Đang bán" : "Đã tắt"}</p></div>
        <button className="text-button" disabled={busy || disabled} data-discard-changes onClick={() => { setEdit(row); setNotice(""); }} aria-label={`Sửa cỡ ${row.size_name}`}>Chỉnh sửa</button>
      </li>)}
    </ul>
    {!busy && !rows.length && <p>Chưa có cỡ bổ sung. Bó hoa vẫn dùng cỡ Tiêu chuẩn.</p>}
    {edit && <form key={`${edit.id || "new"}-${edit.version || 0}`} onSubmit={save}>
      <fieldset disabled={busy || disabled}>
        <div className="form-grid">
          <label>Mã cỡ bó (2–40 chữ/số, _ hoặc -)<input name="sku" defaultValue={edit.sku} minLength={2} maxLength={40}
            pattern={"[A-Za-z0-9][A-Za-z0-9_\\-]{1,39}"} title="Mã bắt đầu bằng chữ hoặc số; chỉ dùng chữ, số, dấu gạch dưới hoặc gạch ngang." required /></label>
          <label>Tên cỡ<input name="size_name" defaultValue={edit.size_name} minLength={2} maxLength={60} required /></label>
          <label>Giá (VNĐ)<input name="price" type="number" min={1000} max={100000000} step={1} defaultValue={edit.price} required /></label>
        </div>
        <label className="check-label"><input type="checkbox" name="active" defaultChecked={edit.active} />Cho phép đặt cỡ này</label>
        {specificationsEnabled && <label>Quy cách riêng cho cỡ này<textarea name="specification" defaultValue={edit.specification || ''} maxLength={1200} rows={4} placeholder="Mô tả điểm khác với cỡ tiêu chuẩn: loại hoa, độ đầy, cách gói. Chỉ ghi số cành hoặc kích thước khi có thể cam kết." /></label>}
        <div className="form-actions">
          <button className="button primary">Lưu cỡ</button>
          <button type="button" className="button outline" data-discard-changes onClick={() => setEdit(null)}>Hủy sửa cỡ</button>
        </div>
      </fieldset>
    </form>}
  </section>;
}
