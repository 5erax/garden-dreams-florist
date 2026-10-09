import { useEffect, useState } from "react";
import { backend, call, result } from "./backend.js";
import { vietnamDate } from "./order.js";
import { deliveryTimes } from "./DeliveryPicker.jsx";

const weekdays = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];

export default function AdminDelivery() {
  const [settings, setSettings] = useState(null);
  const [rules, setRules] = useState([]), [closures, setClosures] = useState([]), [services, setServices] = useState([]);
  const [edit, setEdit] = useState(null), [holiday, setHoliday] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const [config, schedule, holidays, shipping] = await Promise.all([
        result(backend.from("gd_delivery_settings").select("*").eq("id", 1).single()),
        result(backend.from("gd_delivery_rules").select("*").order("shipping_id").order("delivery_time")),
        result(backend.from("gd_delivery_closures").select("*").gte("delivery_date", vietnamDate()).order("delivery_date").limit(100)),
        result(backend.from("gd_shipping").select("*").order("name")),
      ]);
      setSettings(config); setRules(schedule); setClosures(holidays); setServices(shipping);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  async function mutate(name, args, success) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await call(name, args);
      setEdit(null); setHoliday(null);
      await load(); setNotice(success);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function saveRule(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate("gd_save_delivery_rule", {
      p_id: edit.id || null, p_version: edit.version || null,
      p_fields: {
        shippingId: edit.id ? edit.shipping_id : data.get("shippingId"),
        deliveryTime: edit.id ? edit.delivery_time : data.get("deliveryTime"),
        weekdays: data.getAll("weekday").map(Number), capacity: Number(data.get("capacity")),
        leadMinutes: Number(data.get("leadMinutes")), active: data.get("active") === "on",
      },
    }, "Đã lưu ca giao. Lịch và điều kiện trên đơn cũ được giữ lại.");
  }
  async function saveHoliday(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate("gd_save_delivery_closure", {
      p_id: holiday.id || null, p_version: holiday.version || null,
      p_fields: {
        shippingId: holiday.id ? holiday.shipping_id : data.get("shippingId"),
        date: holiday.id ? holiday.delivery_date : data.get("date"),
        reason: data.get("reason").trim(), active: data.get("active") === "on",
      },
    }, "Đã lưu ngày nghỉ. Ngày có đơn đã giữ chỗ cần được xử lý trước khi đóng lịch.");
  }
  const serviceName = id => services.find(service => service.id === id)?.name || "Dịch vụ giao hoa";
  return <section className="delivery-admin" aria-label="Quản lý lịch giao hoa">
    <div className="portal-section-heading">
      <div><h2>Lịch của người giao hoa</h2><p>Ca giao, sức chứa và ngày nghỉ theo từng khu vực.</p></div>
      <button className="button outline" disabled={busy} onClick={() => { setEdit(null); setHoliday(null); load(); }}>Tải lại lịch</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    {busy && <p role="status">Đang cập nhật lịch giao…</p>}
    {settings && <div className="delivery-mode">
      <div><h3>{settings.enabled ? "Đang kiểm tra lịch tự động" : "Đang xác nhận lịch thủ công"}</h3>
        <p>Bật để khách chọn ca hợp lệ theo giờ Việt Nam. Xác nhận đơn sẽ dùng một chỗ trong ca; hủy đơn nhả chỗ. Tắt sẽ quay về xác nhận thủ công, các điều kiện lịch đã lưu vẫn nằm trên đơn cũ.</p></div>
      <button className="button primary" disabled={busy} onClick={() => mutate("gd_set_delivery_calendar", {
        p_version: settings.version, p_enabled: !settings.enabled,
      }, settings.enabled ? "Đã chuyển lịch sang chế độ thủ công." : "Đã bật kiểm tra lịch giao.")}>
        {settings.enabled ? "Chuyển sang thủ công" : "Bật lịch giao tự động"}
      </button>
    </div>}
    <div className="portal-section-heading">
      <h3>Các ca giao</h3>
      <button className="button outline" disabled={busy || !services.length} onClick={() => {
        setHoliday(null); setNotice(""); setEdit({shipping_id: services[0]?.id, delivery_time: deliveryTimes[0], weekdays:[1,2,3,4,5,6,7],capacity:0,lead_minutes:0,active:false});
      }}>Thêm ca giao</button>
    </div>
    {!busy && !rules.length && <p className="portal-empty">Chưa có ca giao. Tạo ca theo năng lực thực tế của shop, rồi bật lịch khi đã kiểm tra.</p>}
    <div className="delivery-rule-grid">
      {rules.map(rule => <article className="delivery-rule-card" key={rule.id}>
        <span className="eyebrow">{serviceName(rule.shipping_id)}</span>
        <h3>{rule.delivery_time}</h3>
        <p>{rule.weekdays.map(day => weekdays[day - 1]).join(" · ")}</p>
        <dl><div><dt>Sức chứa</dt><dd>{rule.capacity} đơn / ngày</dd></div>
          <div><dt>Đặt trước giờ bắt đầu</dt><dd>{rule.lead_minutes} phút</dd></div></dl>
        <span className="status-badge">{rule.active ? "Đang áp dụng" : "Đã tắt"}</span>
        <button className="text-button" disabled={busy} onClick={() => { setHoliday(null); setEdit(rule); setNotice(""); }}>Chỉnh ca giao</button>
      </article>)}
    </div>
    {edit && <form className="admin-edit-form" key={`${edit.id || "new"}-${edit.version || 0}`} onSubmit={saveRule}>
      <h3>{edit.id ? "Chỉnh ca giao" : "Tạo ca giao"}</h3>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label>Khu vực<select name="shippingId" defaultValue={edit.shipping_id} disabled={Boolean(edit.id)} required>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}{!service.active && " (đang tắt)"}</option>)}
          </select></label>
          <label>Ca giao<select name="deliveryTime" defaultValue={edit.delivery_time} disabled={Boolean(edit.id)} required>
            {deliveryTimes.map(time => <option key={time}>{time}</option>)}
          </select></label>
          <label>Sức chứa mỗi ngày<input type="number" name="capacity" min={0} max={500} step={1} defaultValue={edit.capacity} required /></label>
          <label>Thời gian cần đặt trước (phút)<input type="number" name="leadMinutes" min={0} max={43200} step={1} defaultValue={edit.lead_minutes} required /></label>
        </div>
        <p className="fineprint">Ví dụ ca 13h và đặt trước 120 phút sẽ ngừng nhận vào 11h. Số 0 ở sức chứa nghĩa là không còn nhận trong ca; không thể giảm thấp hơn số đơn đã giữ chỗ.</p>
        <fieldset className="weekday-options"><legend>Ngày hoạt động trong tuần</legend>
          {weekdays.map((name, index) => <label className="check-label" key={name}><input type="checkbox" name="weekday" value={index + 1} defaultChecked={edit.weekdays.includes(index + 1)} />{name}</label>)}
        </fieldset>
        <label className="check-label"><input type="checkbox" name="active" defaultChecked={edit.active} />Cho phép nhận yêu cầu trong ca này</label>
        <div className="form-actions"><button className="button primary">Lưu ca giao</button><button type="button" className="button outline" onClick={() => setEdit(null)}>Hủy sửa</button></div>
      </fieldset>
    </form>}
    <div className="portal-section-heading"><h3>Ngày nghỉ theo khu vực</h3>
      <button className="button outline" disabled={busy || !services.length} onClick={() => { setEdit(null); setHoliday({shipping_id:services[0]?.id,delivery_date:"",reason:"",active:true}); setNotice(""); }}>Thêm ngày nghỉ</button>
    </div>
    <ul className="delivery-holidays">
      {closures.map(closure => <li key={closure.id}><div>
        <strong>{new Intl.DateTimeFormat("vi-VN").format(new Date(`${closure.delivery_date}T12:00:00+07:00`))} · {serviceName(closure.shipping_id)}</strong>
        <p>{closure.reason || "Ngày nghỉ của cửa hàng"} · {closure.active ? "Đóng lịch" : "Đã mở lại"}</p>
      </div><button className="text-button" disabled={busy} onClick={() => {setEdit(null);setHoliday(closure);setNotice("");}}>Chỉnh ngày nghỉ</button></li>)}
    </ul>
    {!busy && !closures.length && <p>Chưa có ngày nghỉ sắp tới. Danh sách hiển thị tối đa 100 ngày cấu hình.</p>}
    {holiday && <form className="admin-edit-form" key={`${holiday.id || "new"}-${holiday.version || 0}`} onSubmit={saveHoliday}>
      <h3>{holiday.id ? "Chỉnh ngày nghỉ" : "Thêm ngày nghỉ"}</h3>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label>Khu vực<select name="shippingId" defaultValue={holiday.shipping_id} disabled={Boolean(holiday.id)} required>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select></label>
          <label>Ngày nghỉ<input type="date" name="date" min={vietnamDate()} max={vietnamDate(new Date(Date.now()+365*86400000))} defaultValue={holiday.delivery_date} disabled={Boolean(holiday.id)} required /></label>
        </div>
        <label>Lý do nội bộ<input name="reason" maxLength={200} defaultValue={holiday.reason} /></label>
        <label className="check-label"><input type="checkbox" name="active" defaultChecked={holiday.active} />Đóng lịch ngày này</label>
        <div className="form-actions"><button className="button primary">Lưu ngày nghỉ</button><button type="button" className="button outline" onClick={() => setHoliday(null)}>Hủy sửa</button></div>
      </fieldset>
    </form>}
  </section>;
}
