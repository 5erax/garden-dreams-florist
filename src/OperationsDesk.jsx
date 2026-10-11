import { deliveryRemaining } from "./admin-ux.js";
import BloomDate from "./BloomDate.jsx";
import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useRef, useState } from "react";
import { backend, call, result, orderColumns, orderStatuses, paymentStatuses } from "./backend.js";
import { vietnamDate } from "./order.js";
import { money } from "./catalog.js";
import OrderDetail from "./OrderDetail.jsx";
import StaffNotes from "./StaffNotes.jsx";

const queues=[['ALL','Tất cả'],['OVERDUE','Qua ngày giao'],['PENDING','Chờ xác nhận'],['PACKING','Cần bó hoa'],['CONFIRMED','Đã xác nhận'],['PREPARING','Đang bó hoa'],['SHIPPING','Đang giao'],['COLLECTION','Cần đối soát'],['DELIVERED','Đã giao'],['CANCELLED','Đã hủy']];
export default function OperationsDesk({initialQueue='ALL'}) {
  const [day,setDay]=useState(initialQueue==='OVERDUE'?'':vietnamDate()),[queue,setQueue]=useState(initialQueue),[search,setSearch]=useState(''),[query,setQuery]=useState('');
  const [rows,setRows]=useState([]),[summary,setSummary]=useState(null),[selected,setSelected]=useState(null);
  const [loadedKey,setLoadedKey]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[revision,setRevision]=useState(0);
  const sequence=useRef(0),pendingPrint=useRef(null);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(selected && pendingPrint.current===selected.id){pendingPrint.current=null;document.documentElement.dataset.printOrder=selected.id;window.print();delete document.documentElement.dataset.printOrder;}},[selected?.id]);
  async function confirmOrder(order){if(busy)return;setBusy(true);setError('');try{await call('gd_update_order',{p_id:order.id,p_version:order.version,p_status:'CONFIRMED',p_payment:order.payment_status,p_note:''});setRevision(value=>value+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function openOrder(order,print=false){
    const key=filterKey,request=++sequence.current;setBusy(true);setError('');
    try{const detail=await result(backend.from('gd_orders').select(orderColumns).eq('id',order.id).single());if(sequence.current===request&&current.current===key){if(print)pendingPrint.current=detail.id;setSelected(detail);}}catch(e){if(sequence.current===request&&current.current===key)setError(e.message);}finally{if(sequence.current===request&&current.current===key)setBusy(false);}
  }
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
      <button aria-pressed={queue==='PENDING'} onClick={()=>setQueue('PENDING')}><span>Chờ xác nhận</span><strong>{summary.pending}</strong></button>
      <button onClick={()=>setQueue('PACKING')}><span>Cần bó hoa</span><strong>{summary.preparing}</strong></button>
      <button aria-pressed={queue==='SHIPPING'} onClick={()=>setQueue('SHIPPING')}><span>Đang giao</span><strong>{summary.shipping}</strong></button>
      <button aria-pressed={queue==='COLLECTION'} onClick={()=>setQueue('COLLECTION')}><span>Cần đối soát</span><strong>{summary.needsCollection}</strong></button>
      <article><span>Tiền đang giữ</span><strong>{money(summary.heldCash)}</strong></article>
      <article><span>Còn phải thu</span><strong>{money(summary.outstanding)}</strong></article>
    </div>}
    <p className="fineprint">Tổng theo ngày giao {day || 'hôm nay'}, độc lập bộ lọc hàng đợi. Tiền đã ghi nhận không phải lợi nhuận; chỉ thay đổi khi admin đối soát. Môi trường thử chỉ hiển thị dữ liệu thử.</p>
    <nav className="operations-queues" aria-label="Hàng đợi công việc">{queues.map(([key,label])=><button key={key} aria-pressed={queue===key} onClick={()=>setQueue(key)}>{label}{summary && key==='PENDING' && ` (${summary.pending})`}{summary && key==='SHIPPING' && ` (${summary.shipping})`}{summary && key==='COLLECTION' && ` (${summary.needsCollection})`}</button>)}</nav>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <BloomLoader compact label="Bàn xử lý đơn" />}
    {!busy && !error && !rows.length && <div className="portal-empty"><h3>Không có đơn trong hàng đợi này.</h3><p>Đổi ngày, bộ lọc hoặc mã đơn để tìm công việc cần xử lý.</p></div>}
    <div className="operations-orders">{(loadedKey===filterKey ? rows : []).map(order=><article className="operations-order-wrap" key={order.id}><button className="operations-order" disabled={busy} onClick={()=>openOrder(order)}>
      <div><span className="eyebrow">{order.reference}</span><h3>{order.recipient_name||'Thông tin đã hết hạn lưu'}</h3><p>{order.delivery_date} · {order.delivery_time}</p>{!['DELIVERED','CANCELLED'].includes(order.status)&&<p>{deliveryRemaining(order,now)}</p>}</div>
      <div><span className="status-badge">{orderStatuses[order.status]}</span><p><span className="status-badge">{paymentStatuses[order.payment_status]}</span> · {order.payment_method}</p></div><div><strong>{money(order.total)}</strong><p>{order.shipping_name}</p><span className="text-link">Mở và xử lý</span></div></button>
      <div className="order-tools">{order.status==='PENDING'&&<button className="button primary" disabled={busy} onClick={()=>confirmOrder(order)}>Xác nhận đơn</button>}{(order.buyer_phone||order.recipient_phone)&&<><a className="button outline" href={'tel:'+(order.buyer_phone||order.recipient_phone)}>Gọi {order.buyer_phone?'người đặt':'người nhận'}</a><a className="button outline" href={'https://zalo.me/'+(order.buyer_phone||order.recipient_phone).replace(/^\+84/,'0')} target="_blank" rel="noreferrer">Zalo</a></>}<button className="button outline" disabled={busy} onClick={()=>openOrder(order,true)}>In phiếu giao</button></div>
    </article>)}</div>
    {more && loadedKey===filterKey && <button className="button outline" disabled={busy} onClick={()=>load(true)}>Tải thêm đơn</button>}
  </section>;
}
