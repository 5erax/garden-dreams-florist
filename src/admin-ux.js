export const inventoryUnit = unit => ({STEM:'cành',UNIT:'đơn vị',ROLL:'cuộn',GRAM:'gram'})[unit] || unit;
export function datePresets(today) {
  const date = new Date(today+'T12:00:00Z');
  const shift = days => new Date(date.getTime()+days*86400000).toISOString().slice(0,10);
  const previousEnd = today.slice(0,8)+'01';
  const end = new Date(new Date(previousEnd+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10);
  return [['Hôm nay',today,today],['7 ngày',shift(-6),today],['Tháng này',previousEnd,today],['Tháng trước',end.slice(0,8)+'01',end]];
}
export function batchState(batch,today) {
  const days = Math.round((Date.parse(batch.expires_on)-Date.parse(today))/86400000);
  return days<0?'expired':days<=3?'soon':'fresh';
}
export function cutoffLabel(time,minutes) {
  const hour=Number(time.match(/(\d+)[–-]/)?.[1]);
  if(!Number.isFinite(hour)||!Number.isFinite(minutes)||minutes<0)return 'Chưa xác định';
  const value=hour*60-minutes;
  if(value<0)return 'Trước ngày giao '+Math.ceil(-value/1440)+' ngày';
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
export function csvText(rows) {
 return '\uFEFF'+rows.map(row=>row.map(value=> '"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');
}
export function downloadCsv(rows,name) {
 const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function recipeCsv(text,ingredients) {
 if(text.length>64000)throw Error('CSV tối đa 64 KB.');
 const rows=[],row=[];let cell='',quoted=false;
 const source=text.replace(/^\uFEFF/,'').trim();
 for(let i=0;i<source.length;i++) {const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(c===','||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){rows.push([...row]);row.length=0;}}
  else if(c!=='\r'||quoted)cell+=c;
 }
 if(quoted)throw Error('CSV có dấu nháy chưa đóng.');row.push(cell.trim());rows.push(row);
 if(rows[0]?.length!==2||rows.length<2||rows.length>51)throw Error('CSV cần hai cột và 1–50 dòng nguyên liệu.');
 const seen=new Set();return rows.slice(1).map(([name,quantity,...extra])=>{
 const item=ingredients.find(item=>item.name.toLocaleLowerCase('vi')===name?.toLocaleLowerCase('vi'));
 if(extra.length||!item||!/^\d+$/.test(quantity)||Number(quantity)<1||Number(quantity)>10000||seen.has(item.id))throw Error('Kiểm tra tên nguyên liệu, số lượng và dòng trùng trong CSV.');
 seen.add(item.id);return {ingredientId:item.id,quantity:Number(quantity)};});
}

export function deliveryRemaining(order,now=Date.now()){const end=deliveryDeadline(order);if(!Number.isFinite(end))return '';const minutes=Math.ceil((end-now)/60000);return minutes>=0?'Còn '+Math.floor(minutes/60)+'h '+minutes%60+' phút đến hết ca giao':'Đã qua khung giờ giao '+Math.floor(-minutes/60)+'h '+(-minutes)%60+' phút';}

export function deliveryDeadline(order){const hour=Number(order.delivery_time?.match(/[–-](\d+)h/)?.[1]);return Number.isFinite(hour)?Date.parse(order.delivery_date+'T'+String(hour).padStart(2,'0')+':00:00+07:00'):NaN;}
export const isOverdue=(order,now=Date.now())=>!['DELIVERED','CANCELLED'].includes(order.status)&&deliveryDeadline(order)<now;
export const formatDate=value=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value.length===10?value+'T12:00:00+07:00':value));
export const formatDateTime=value=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export function inventoryChecklist(data,products,today){return data.readiness||{ingredients:data.ingredients.length>0,recipes:products.length>0&&products.every(product=>[null,...(product.variants||[]).filter(v=>v.active).map(v=>v.id)].every(variant=>data.recipes.some(recipe=>recipe.product_id===product.id&&(recipe.variant_id??null)===variant))),stock:data.batches.some(batch=>batch.expires_on>=today&&batch.on_hand>batch.reserved)};}
