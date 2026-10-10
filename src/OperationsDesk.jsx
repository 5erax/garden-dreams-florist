import BloomDate from "./BloomDate.jsx";
import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useRef, useState } from "react";
import { backend, call, result, orderColumns, orderStatuses, paymentStatuses } from "./backend.js";
import { vietnamDate } from "./order.js";
import { money } from "./catalog.js";
import OrderDetail from "./OrderDetail.jsx";
import StaffNotes from "./StaffNotes.jsx";

const queues=[['ALL','Tất cả'],['PENDING','Chờ xác nhận'],['CONFIRMED','Đã nhận'],['PREPARING','Đang bó'],['SHIPPING','Đang giao'],['COLLECTION','Cần đối soát'],['DELIVERED','Đã giao'],['CANCELLED','Đã hủy']];
export default function OperationsDesk() {
  const [day,setDay]=useState(vietnamDate()),[queue,setQueue]=useState('ALL'),[search,setSearch]=useState(''),[query,setQuery]=useState('');
  const [rows,setRows]=useState([]),[summary,setSummary]=useState(null),[selected,setSelected]=useState(null);
  const [loadedKey,setLoadedKey]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[revision,setRevision]=useState(0);
  const sequence=useRef(0);
  const filterKey=`${queue}:${day}:${query}:${revision}`;
  const current=useRef(filterKey);current.current=filterKey;
  async function load(append=false) {
    const request=++sequence.current,key=filterKey;
    setBusy(true);setError('');
    const last=append ? rows.at(-1) : null;
    try {
      const [page,totals]=await Promise.all([
        call('gd_operations_queue',{p_queue:queue,p_day:day || null,p_search:query,p_before:last?.created_at || null,p_before_id:last?.id || null,p_limit:30}),
        call('gd_operations_summary',{p_day:day || vietnamDate()}),
      ]);
      if(sequence.current!==request || current.current!==key)return;
      setRows(old=>append ? [...old,...page.slice(0,30)] : page.slice(0,30));
      setLoadedKey(key);
      setSummary(totals);setMore(page.length>30);
    }catch(e){if(sequence.current===request && current.current===key)setError(e.message);}
    finally{if(sequence.current===request && current.current===key)setBusy(false);}
  }
  useEffect(()=>{setRows([]);setSummary(null);setSelected(null);load();return()=>{sequence.current++;};},[filterKey]);

  if(selected)return <section className="operations-desk">
    <button className="text-button back-link" onClick={()=>{setSelected(null);setRevision(value=>value+1);}}>← Trở về bàn xử lý đơn</button>
    <OrderDetail order={selected} admin onUpdated={setSelected}/>
    <StaffNotes key={selected.id} orderId={selected.id}/>
  </section>;
  return <section className="operations-desk" aria-label="Bàn xử lý đơn theo ca">
    <div className="portal-section-heading"><div><span className="eyebrow">MỘT CA LÀM VIỆC</span><h2>Bàn chăm những bó hoa</h2></div>
      <button className="button outline" disabled={busy} onClick={()=>setRevision(value=>value+1)}>Cập nhật bàn làm việc</button>
    </div>
    <div className="operations-filter">
      <label>Ngày giao<BloomDate  value={day} onChange={event=>setDay(event.target.value)}/></label>
      <button className="text-button" onClick={()=>setDay(vietnamDate())}>Hôm nay</button>
      <button className="text-button" onClick={()=>setDay('')}>Mọi ngày</button>
      <form onSubmit={event=>{event.preventDefault();setQuery(search.trim().toUpperCase());}}>
        <label>Tìm mã đơn<input value={search} maxLength={40} onChange={event=>setSearch(event.target.value)} placeholder="GD-…" /></label>
        <button className="button outline">Tìm đơn</button>
      </form>
    </div>
    {summary && loadedKey===filterKey && <div className="operations-metrics" aria-label={`Công việc ngày ${summary.day}`}>
      <article><span>Chờ xác nhận</span><strong>{summary.pending}</strong></article>
      <article><span>Cần bó hoa</span><strong>{summary.preparing}</strong></article>
      <article><span>Đang giao</span><strong>{summary.shipping}</strong></article>
      <article><span>Cần đối soát</span><strong>{summary.needsCollection}</strong></article>
      <article><span>Tiền đã ghi nhận, chưa hoàn</span><strong>{money(summary.heldCash)}</strong></article>
      <article><span>Còn cần thu</span><strong>{money(summary.outstanding)}</strong></article>
    </div>}
    <p className="fineprint">Tổng theo ngày giao {day || 'hôm nay'}, độc lập bộ lọc hàng đợi. Tiền đã ghi nhận không phải lợi nhuận; chỉ thay đổi khi admin đối soát. Môi trường thử chỉ hiển thị dữ liệu thử.</p>
    <nav className="operations-queues" aria-label="Hàng đợi công việc">{queues.map(([key,label])=><button key={key} aria-pressed={queue===key} onClick={()=>setQueue(key)}>{label}</button>)}</nav>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <BloomLoader compact label="Bàn xử lý đơn" />}
    {!busy && !error && !rows.length && <div className="portal-empty"><h3>Không có đơn trong hàng đợi này.</h3><p>Đổi ngày, bộ lọc hoặc mã đơn để tìm công việc cần xử lý.</p></div>}
    <div className="operations-orders">{(loadedKey===filterKey ? rows : []).map(order=><button className="operations-order" key={order.id} disabled={busy} onClick={async()=>{
      const key=filterKey,request=++sequence.current;setBusy(true);setError('');
      try {
        const detail=await result(backend.from('gd_orders').select(orderColumns).eq('id',order.id).single());
        if(sequence.current===request && current.current===key)setSelected(detail);
      }catch(e){if(sequence.current===request && current.current===key)setError(e.message);}
      finally{if(sequence.current===request && current.current===key)setBusy(false);}
    }}>
      <div><span className="eyebrow">{order.reference}</span><h3>{order.recipient_name || 'Thông tin đã hết hạn lưu'}</h3><p>{order.delivery_date} · {order.delivery_time}</p></div>
      <div><span className="status-badge">{orderStatuses[order.status]}</span><p>{paymentStatuses[order.payment_status]} · {order.payment_method}</p></div>
      <div><strong>{money(order.total)}</strong><p>{order.shipping_name}</p><span className="text-link">Xem & xử lý →</span></div>
    </button>)}</div>
    {more && loadedKey===filterKey && <button className="button outline" disabled={busy} onClick={()=>load(true)}>Tải thêm đơn</button>}
  </section>;
}
