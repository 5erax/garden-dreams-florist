import { useState } from 'react';
import { orderStatuses } from './backend.js';
export const nextOrderStatus = status => ({PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'SHIPPING',SHIPPING:'DELIVERED'})[status] || null;
export function OrderProgress({order}) {
 const steps=['PENDING','CONFIRMED','SHIPPING','DELIVERED'];
 const index=order.status==='PREPARING'?1:steps.indexOf(order.status);
 return <ol className="order-progress" aria-label="Tiến trình giao hoa">{steps.map((step,i)=><li key={step} className={i<=index?'is-complete':''} aria-current={i===index?'step':undefined}><span>{i+1}</span>{i===0?'Đã nhận yêu cầu':orderStatuses[step]}</li>)}</ol>;
}
export function OrderTools({order,admin}) {
 const [notice,setNotice]=useState('');
 return <div className="order-tools">{admin && order.recipient_phone && <><a className="button outline" href={'tel:'+order.recipient_phone}>Gọi người nhận</a><a className="button outline" href={'https://zalo.me/'+order.recipient_phone.replace(/^\+84/,'0')} target="_blank" rel="noreferrer">Zalo người nhận</a></>}
 <button type="button" className="button outline" onClick={()=>{document.documentElement.dataset.printOrder=order.id;window.print();delete document.documentElement.dataset.printOrder;}}>In phiếu giao / thiệp</button>
 <button type="button" className="button outline" onClick={async()=>{try {await navigator.clipboard.writeText(order.card_message||'');setNotice('Đã sao chép lời nhắn.');}catch{setNotice('Chưa sao chép được; chọn lời nhắn để sao chép thủ công.');}}}>Sao chép lời nhắn</button>{notice&&<p role="status">{notice}</p>}</div>;
}
