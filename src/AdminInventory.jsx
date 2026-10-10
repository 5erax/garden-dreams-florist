import BloomDate from "./BloomDate.jsx";
import BloomSelect from "./BloomSelect.jsx";
import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useRef, useState } from 'react';
import { call } from './backend.js';
import { useStore } from './Store.jsx';
import { money } from './catalog.js';
import { vietnamDate } from './order.js';
import { sendCheckout } from './checkout-request.js';

export default function AdminInventory() {
  const { products, session } = useStore();
  const saleProducts = products.filter(item => item.active !== false && !item.reference_only);
  const [tool, setTool] = useState(null);
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(saleProducts[0]?.id || ''), [variantId, setVariantId] = useState('');
  const [lines, setLines] = useState([{ ingredientId: '', quantity: 1 }]);
  const pending = useRef(null), mounted = useRef(true);
  useEffect(() => {
    if (!saleProducts.some(item => item.id === Number(productId))) {
      setProductId(saleProducts[0]?.id || ''); setVariantId('');
    }
  }, [products, productId]);
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);
  async function load() {
    try { const state = await call('gd_inventory_state'); if (mounted.current) { setData(state); setError(''); } }
    catch (failure) { if (mounted.current) setError(failure.message); }
  }
  async function save(action, body, form) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await sendCheckout(pending, session.user.id, {p_id:crypto.randomUUID(),p_action:action,p_body:body}, request => call('gd_inventory_command',request));
      if (mounted.current) { setNotice('Đã lưu. Kho và công thức đã cập nhật.'); form?.reset(); await load(); }
    } catch (failure) {
      if (failure.cause?.code === '23505') pending.current = null;
      if (mounted.current) setError(failure.cause?.code === '23505' ? 'Nguyên liệu đã tồn tại hoặc công thức có dòng trùng. Kiểm tra và sửa lựa chọn.' : failure.message);
    }
    finally { if (mounted.current) setBusy(false); }
  }
  const submit = (action, map) => event => {
    event.preventDefault(); const form = event.currentTarget;
    save(action, map(Object.fromEntries(new FormData(form))), form);
  };
  if (!data) return <div>{error ? <p role="alert">{error}</p> : <BloomLoader label="Kho hoa" />}<button className="text-button" onClick={load}>Tải lại</button></div>;
  const product = products.find(item => item.id === Number(productId));
  const ingredientName = id => data.ingredients.find(item => item.id === id)?.name || `#${id}`;
  return <section className="inventory-panel">
    <div className="portal-section-heading"><div><h2>Kho hoa & công thức</h2><p>Nhập lô thật, hạn sử dụng và nguyên liệu của từng cỡ bó. Máy chủ giữ theo lô sắp hết hạn trước.</p></div><button className="text-button" disabled={busy} onClick={load}>Cập nhật kho</button></div>
    <div className="inventory-mode"><div><span className="eyebrow">NGUYÊN LIỆU CHO TỪNG LỜI THƯƠNG</span><h3>{data.enabled ? 'Kho đang giữ nguyên liệu cho đơn' : 'Chuẩn bị kho trước khi bật nhận giữ nguyên liệu'}</h3><p className="fineprint">Chỉ bật sau khi có công thức cho mọi mẫu/cỡ đang bán và đã nhập tồn thật. Đơn có trước khi bật không được tự giữ kho. Khi bắt đầu bó, phần đã giữ được trừ; hủy sau khi đã bó không tự cộng nguyên liệu đã dùng.</p>
    <button className="button primary" disabled={busy || Boolean(pending.current)} onClick={() => save('ENABLE', {enabled:!data.enabled})}>{data.enabled ? 'Tắt kiểm soát tồn cho đơn mới' : 'Bật kiểm soát tồn cho đơn mới'}</button>
    <p role="status">{data.enabled ? 'Đang chặn đặt vượt nguyên liệu cho đơn mới.' : 'Kiểm soát tồn chưa bật; đơn mới chưa giữ nguyên liệu.'}</p>
    </div></div>
    <div className="inventory-metrics">{[[data.ingredients.length,'nguyên liệu'],[data.batches.length,'lô gần nhất'],[data.recipes.length,'công thức đang dùng'],[data.batches.filter(batch=>batch.expires_on<vietnamDate()).length,'lô đã hết hạn trong danh sách']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {pending.current && <p role="status">Kết quả thao tác chưa rõ. Không nhập lại lô bằng thao tác mới.<button className="text-button" disabled={busy} onClick={() => save(pending.current.request.p_action,pending.current.request.p_body)}>Kiểm tra lại thao tác vừa gửi</button> Sau khi tải lại trang, kiểm tra mã lô và sổ biến động trước khi nhập lại.</p>}
    <nav className="inventory-tools" aria-label="Thao tác kho">{[['INGREDIENT','Thêm nguyên liệu'],['RECEIVE','Nhập lô hoa'],['RECIPE','Soạn công thức'],['WASTE','Ghi hao hụt']].map(([key,label])=><button key={key} disabled={busy || Boolean(pending.current)} aria-pressed={tool===key} onClick={()=>setTool(tool===key?null:key)}>{label}</button>)}</nav>
    <fieldset disabled={busy || Boolean(pending.current)} className="inventory-forms">
      <section className="inventory-editor" hidden={tool!=='INGREDIENT'}><h3>Thêm nguyên liệu</h3><form className="portal-form" onSubmit={submit('INGREDIENT', body => body)}><label>Tên nguyên liệu<input name="name" required minLength={2} maxLength={120} placeholder="Ví dụ: Hồng đỏ loại A" /></label><label>Đơn vị<BloomSelect name="unit"><option value="STEM">Cành</option><option value="UNIT">Đơn vị / vật tư</option></BloomSelect></label><button className="button">Thêm nguyên liệu</button></form></section>
      <section className="inventory-editor" hidden={tool!=='RECEIVE'}><h3>Nhập lô hoa</h3><form className="portal-form" onSubmit={submit('RECEIVE', body => ({...body,ingredientId:Number(body.ingredientId),quantity:Number(body.quantity),unitCost:Number(body.unitCost)}))}>
        <label>Nguyên liệu<BloomSelect name="ingredientId" required defaultValue=""><option value="" disabled>Chọn nguyên liệu</option>{data.ingredients.map(item => <option key={item.id} value={item.id}>{item.name} · {item.unit === 'STEM' ? 'cành' : 'đơn vị'}</option>)}</BloomSelect></label>
        <label>Mã lô<input name="code" required maxLength={80}/></label><label>Nhà cung cấp<input name="supplier" maxLength={120}/></label><label>Số lượng<input name="quantity" type="number" min={1} max={9999999} step={1} required/></label><label>Giá vốn mỗi cành/đơn vị (VNĐ)<input name="unitCost" type="number" min={0} max={100000000} step={1} required/></label><label>Sử dụng được đến hết ngày<BloomDate name="expiresOn"  min={vietnamDate(new Date())} required/></label><button className="button">Nhập kho</button>
      </form></section>
      <section className="inventory-editor" hidden={tool!=='RECIPE'}><h3>Công thức theo cỡ bó</h3><form className="portal-form" onSubmit={event => {event.preventDefault(); save('RECIPE',{productId:Number(productId),variantId:variantId ? Number(variantId) : null,lines:lines.map(line => ({ingredientId:Number(line.ingredientId),quantity:Number(line.quantity)}))});}}>
        <label>Mẫu hoa<BloomSelect value={productId} onChange={event => {setProductId(event.target.value);setVariantId('');}}>{saleProducts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</BloomSelect></label><label>Cỡ<BloomSelect value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">Tiêu chuẩn</option>{product?.variants?.map(item => <option key={item.id} value={item.id}>{item.size_name}</option>)}</BloomSelect></label>
        {lines.map((line,index) => <div className="inventory-recipe-line" key={index}><label>Nguyên liệu {index+1}<BloomSelect required value={line.ingredientId} onChange={event => setLines(current => current.map((value,i) => i === index ? {...value,ingredientId:event.target.value} : value))}><option value="" disabled>Chọn nguyên liệu</option>{data.ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</BloomSelect></label><label>Số lượng cho một bó<input type="number" required min={1} max={10000} step={1} value={line.quantity} onChange={event => setLines(current => current.map((value,i) => i === index ? {...value,quantity:event.target.value} : value))}/></label><button className="text-button" type="button" disabled={lines.length===1} onClick={() => setLines(current => current.filter((_,i) => i!==index))}>Bỏ dòng</button></div>)}
        <button type="button" className="text-button" disabled={lines.length>=50} onClick={() => setLines(current => [...current,{ingredientId:'',quantity:1}])}>+ Thêm thành phần</button><button className="button">Lưu phiên bản công thức mới</button>
      </form></section>
      <section className="inventory-editor" hidden={tool!=='WASTE'}><h3>Ghi nhận hoa hỏng / hao hụt</h3><form className="portal-form" onSubmit={submit('WASTE', body => ({...body,quantity:Number(body.quantity)}))}><label>Lô<BloomSelect name="batchId" required defaultValue=""><option value="" disabled>Chọn lô</option>{data.batches.map(item => <option key={item.id} value={item.id}>{item.code} · {ingredientName(item.ingredient_id)} · chưa giữ {item.on_hand-item.reserved}</option>)}</BloomSelect></label><label>Số lượng<input name="quantity" type="number" min={1} max={9999999} step={1} required/></label><label>Lý do<textarea name="reason" required minLength={5} maxLength={500}/></label><p className="fineprint">Không trừ phần đang giữ cho đơn. Xử lý đơn bị ảnh hưởng trước khi ghi nhận hao hụt phần đó.</p><button className="button">Ghi hao hụt</button></form></section>
    </fieldset>
    <h3>Tồn theo lô · tối đa 200 lô gần nhất</h3><div className="inventory-table"><table><thead><tr><th>Nguyên liệu / lô</th><th>Hạn dùng</th><th>Tồn</th><th>Đã giữ</th><th>Chưa giữ</th><th>Giá vốn</th></tr></thead><tbody>{!data.batches.length && <tr><td colSpan={6}><div className="inventory-empty"><h4>Kho đang chờ lô hoa đầu tiên</h4><p>Thêm nguyên liệu, rồi nhập số lượng và hạn dùng thực tế. Không cần nhập công thức trước khi nhập lô.</p><button className="button outline" onClick={()=>setTool(data.ingredients.length?'RECEIVE':'INGREDIENT')}>{data.ingredients.length?'Nhập lô đầu tiên':'Thêm nguyên liệu đầu tiên'}</button></div></td></tr>}{data.batches.map(batch => <tr key={batch.id}><th scope="row">{ingredientName(batch.ingredient_id)}<small>{batch.code}</small></th><td>{batch.expires_on}{batch.expires_on<vietnamDate(new Date()) && ' · hết hạn'}</td><td>{batch.on_hand}</td><td>{batch.reserved}</td><td>{batch.on_hand-batch.reserved}</td><td>{money(batch.unit_cost)}</td></tr>)}</tbody></table></div>
    <h3>Công thức đang dùng</h3>{data.recipes.length ? data.recipes.map(recipe => <article className="inventory-recipe-card" key={recipe.id}><span className="eyebrow">CÔNG THỨC · v{recipe.revision}</span><p>{products.find(item=>item.id===recipe.product_id)?.name || `Mẫu #${recipe.product_id}`} · {recipe.variant_id ? (products.find(item=>item.id===recipe.product_id)?.variants?.find(item=>item.id===recipe.variant_id)?.size_name || `cỡ #${recipe.variant_id}`) : 'Tiêu chuẩn'} · v{recipe.revision}: {recipe.lines.map(line => `${ingredientName(line.ingredient_id)} × ${line.quantity}`).join(', ')}</p></article>) : <div className="inventory-empty"><h4>Mỗi bó hoa, một công thức riêng</h4><p>Chọn mẫu và cỡ bó, thêm nguyên liệu cùng số cành shop thực sự dùng.</p><button className="button outline" onClick={()=>setTool('RECIPE')}>Soạn công thức đầu tiên</button></div>}
    <h3>50 biến động gần nhất</h3>{!data.movements.length && <p className="fineprint">Chưa có biến động. Nhập lô hoặc ghi hao hụt sẽ tạo lịch sử tại đây.</p>}{data.movements.map(item => <p key={item.id}>{new Date(item.created_at).toLocaleString('vi-VN')} · {data.batches.find(batch=>batch.id===item.batch_id)?.code || item.batch_id} · {({RECEIVE:'Nhập',WASTE:'Hao hụt',CONSUME:'Đã dùng'})[item.kind]} {item.delta} · {item.reason}</p>)}
  </section>;
}
