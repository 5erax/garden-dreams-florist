import { useEffect, useState } from "react";
import { backend, call, result } from "./backend.js";

export default function StaffNotes({ orderId }) {
  const [rows, setRows] = useState([]), [text, setText] = useState("");
  const [pending, setPending] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load() {
    const rows=await result(backend.from("gd_order_staff_notes").select("id,body,created_at").eq("order_id",orderId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50));
    setRows(rows);
  }
  useEffect(()=>{
    let active=true;
    result(backend.from("gd_order_staff_notes").select("id,body,created_at").eq("order_id",orderId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50))
      .then(rows=>{if(active)setRows(rows);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[orderId]);
  async function save(event) {
    event.preventDefault(); if(busy)return;
    const request=pending || {id:crypto.randomUUID(),body:text.trim()};
    setPending(request);setBusy(true);setError("");
    try {
      await call("gd_add_staff_note",{p_id:request.id,p_order:orderId,p_body:request.body});
      setText("");setPending(null);await load();
    }catch(e){
      setError(e.message);
      if(e.cause?.code==='P0001' && !e.cause.message?.includes('IDEMPOTENCY_CONFLICT'))setPending(null);
    }finally{setBusy(false);}
  }
  return <section className="staff-notes" aria-label="Ghi chú nội bộ">
    <h3>Ghi chú của cửa hàng</h3><p>Chỉ admin thấy phần này. Không đưa ghi chú nội bộ vào hành trình khách hàng.</p>
    <form onSubmit={save}><label>Ghi chú mới<textarea value={pending?.body ?? text} onChange={event=>setText(event.target.value)} minLength={1} maxLength={1000} required disabled={busy || Boolean(pending)} rows={3} /></label>
      <button className="button outline" disabled={busy}>{busy ? "Đang lưu…" : pending ? "Kiểm tra và lưu lại ghi chú" : "Lưu ghi chú nội bộ"}</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ol>{rows.map(row=><li key={row.id}><time dateTime={row.created_at}>{new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(row.created_at))}</time><p>{row.body}</p></li>)}</ol>
    {!rows.length && <p>Chưa có ghi chú nội bộ. Tối đa 50 ghi chú gần nhất được hiển thị.</p>}
  </section>;
}
