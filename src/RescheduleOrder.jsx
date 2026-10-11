import {useState} from 'react';
import BloomDate from './BloomDate.jsx';
import BloomSelect from './BloomSelect.jsx';
import {call} from './backend.js';
import {vietnamDate} from './order.js';

export default function RescheduleOrder({order,onUpdated}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!['PENDING','CONFIRMED'].includes(order.status))return null;
  return <details className="advanced-order"><summary>Đổi lịch giao theo thỏa thuận với khách</summary><form onSubmit={async e=>{
    e.preventDefault();if(busy)return;const data=new FormData(e.currentTarget);setBusy(true);setError('');
    try{onUpdated(await call('gd_reschedule_order',{p_id:order.id,p_version:order.version,p_day:data.get('day'),p_time:data.get('time'),p_note:data.get('note')}));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }}><div className="form-grid"><label>Ngày giao mới<BloomDate name="day" defaultValue={order.delivery_date} min={vietnamDate()} required/></label><label>Khung giờ mới<BloomSelect name="time" defaultValue={order.delivery_time}><option>Sáng · 9–12h</option><option>Chiều · 13–17h</option><option>Tối · 18–20h</option></BloomSelect></label></div>
  <label>Nội dung đã thống nhất với khách<input name="note" required minLength={10} maxLength={500} placeholder="Khách đồng ý nhận vào khung giờ mới…"/></label>
  <label className="checkbox-row"><input type="checkbox" required/>Đã liên hệ và được khách đồng ý đổi lịch</label><p className="fineprint">Giá và địa chỉ được giữ nguyên. Lịch mới phải còn sức chứa và nguyên liệu phù hợp.</p><button className="button primary" disabled={busy}>Lưu lịch giao mới</button>{error&&<p role="alert">{error}</p>}</form></details>;
}
