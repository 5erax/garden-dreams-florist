import {useState} from 'react';
import BloomSelect from './BloomSelect.jsx';
export default function BloomTime({name,defaultValue='08:00'}) {
  const [value,setValue]=useState(defaultValue);
  return <span className="time-24"><BloomSelect value={value.slice(0,2)} aria-label="Giờ" onChange={e=>setValue(e.target.value+value.slice(2))}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</BloomSelect><span>:</span><BloomSelect value={value.slice(3,5)} aria-label="Phút" onChange={e=>setValue(value.slice(0,3)+e.target.value)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</BloomSelect><input type="hidden" name={name} value={value}/></span>;
}
