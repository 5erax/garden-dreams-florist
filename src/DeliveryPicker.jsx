import { useEffect, useState } from "react";
import { call } from "./backend.js";
import { vietnamDate } from "./order.js";

export const deliveryTimes = ["Sáng · 9–12h", "Chiều · 13–17h", "Tối · 18–20h"];
export const deliveryReasons = {
  NO_SLOT: "Không nhận trong ca này",
  DAY_CLOSED: "Ngày nghỉ",
  CUTOFF: "Đã qua giờ nhận đặt",
  FULL: "Ca đã đủ đơn",
  CLOSED: "Chưa nhận giao hoa",
};

export function selectedDelivery(slots, time) {
  return slots.some(slot => slot.time === time && slot.available) ? time : "";
}

export default function DeliveryPicker({ shippingId, calendar = false, initialDate = "", initialTime = "Chiều · 13–17h", onReady, revision = 0 }) {
  const [day, setDay] = useState(initialDate), [time, setTime] = useState(initialTime);
  const [schedule, setSchedule] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = `${shippingId}:${day}:${revision}:${retry}`;

  useEffect(() => {
    let active = true;
    setError(""); setSchedule(null); setBusy(false);
    if (!calendar) { onReady(true); return; }
    if (!day || !shippingId) { onReady(false); return; }
    setBusy(true); onReady(false);
    call("gd_delivery_options", { p_shipping: shippingId, p_day: day }).then(result => {
      if (!active) return;
      setSchedule({ key, ...result });
      if (result.enabled) setTime(current => selectedDelivery(result.slots, current));
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [key, calendar, onReady]);

  const current = !calendar || schedule?.key === key;
  const automatic = calendar && schedule?.enabled;
  const allowed = !calendar || current && schedule && (!automatic || Boolean(selectedDelivery(schedule.slots, time)));
  useEffect(() => { onReady(Boolean(allowed)); }, [allowed, onReady]);

  return <section className="delivery-picker" aria-label="Chọn ngày và ca giao">
    <div className="form-grid">
      <label>Ngày mong muốn
        <input name="deliveryDate" type="date" min={vietnamDate()} max={vietnamDate(new Date(Date.now()+90*86400000))}
          value={day} onChange={event => {setDay(event.target.value);setSchedule(null);if(calendar)onReady(false);}} required />
      </label>
      {!automatic && <label>Khung giờ
        <select name="deliveryTime" value={time || initialTime} disabled={calendar && (!current || busy)} onChange={event => setTime(event.target.value)} required>
          {deliveryTimes.map(label => <option key={label}>{label}</option>)}
        </select>
      </label>}
    </div>
    {busy && <p role="status" className="fineprint">Đang kiểm tra lịch giao…</p>}
    {error && <div className="delivery-schedule-error">
      <p className="form-error" role="alert">{error} Địa chỉ và lời nhắn bạn đang nhập vẫn được giữ.</p>
      <button type="button" className="text-button" onClick={() => setRetry(value => value+1)}>Kiểm tra lịch lại</button>
    </div>}
    {automatic && current && <>
      <fieldset className="delivery-slot-options"><legend>Ca giao khả dụng</legend>
        {schedule.slots.map(slot => <label key={slot.time} className={`delivery-slot ${time === slot.time ? "is-selected" : ""} ${!slot.available ? "is-unavailable" : ""}`}>
          <input type="radio" name="deliveryTime" value={slot.time} checked={time === slot.time} onChange={() => setTime(slot.time)} disabled={!slot.available} required />
          <span><strong>{slot.time}</strong><small>{slot.available ? "Có thể gửi yêu cầu" : deliveryReasons[slot.reason] || "Chưa khả dụng"}</small></span>
        </label>)}
      </fieldset>
      {!schedule.slots.some(slot=>slot.available) && <p className="portal-notice" role="status">Ngày hoặc khu vực này chưa có ca nhận đặt. Chọn ngày khác; thông tin người nhận vẫn được giữ.</p>}
      <p className="fineprint">Yêu cầu chưa giữ chỗ. Shop xác nhận đơn khi ca vẫn còn sức chứa.</p>
    </>}
  </section>;
}
