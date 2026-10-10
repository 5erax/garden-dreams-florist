import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import BloomLoader from './BloomLoader.jsx';
import { dateObject, dateISO, dateText, dateFromText } from './date-field.js';
import { vietnamDate } from './order.js';
import '@daypicker/react/style.css';
const loadCalendar = () => import('./BloomCalendar.jsx');
const Calendar = lazy(loadCalendar);

export default function BloomDate({ value, defaultValue='', onChange, name, min, max, required, disabled, className='', ...props }) {
  const [draft, setDraft] = useState(dateText(value ?? defaultValue));
  const [open, setOpen] = useState(false), [keyboard, setKeyboard] = useState(false);
  const input = useRef(null);
  const iso = dateFromText(draft);
  const inRange = iso && (!min || iso >= min) && (!max || iso <= max);
  useEffect(() => { if (value !== undefined) setDraft(dateText(value)); }, [value]);
  useEffect(() => {
    input.current?.setCustomValidity(draft && !inRange ? 'Chọn ngày hợp lệ trong khoảng cho phép (ngày/tháng/năm).' : '');
  }, [draft, inRange]);
  useEffect(() => {
    if (value !== undefined) return;
    const form = input.current?.form;
    const reset = () => { setDraft(dateText(defaultValue)); setOpen(false); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue, value]);
  const update = text => {
    setDraft(text);
    const next = dateFromText(text);
    if (!text || next && (!min || next >= min) && (!max || next <= max)) onChange?.({ target: { name, value: next } });
  };
  return <span className={`bloom-date ${className}`}>
    <input {...props} ref={input} className="bloom-date-input" type="text" value={draft} required={required} disabled={disabled}
      placeholder="dd/mm/yyyy" inputMode="numeric" autoComplete="off" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      onChange={e => update(e.target.value)} />
    <input type="hidden" name={name} disabled={disabled} value={inRange ? iso : ''} />
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="bloom-date-trigger" disabled={disabled} aria-label="Mở lịch chọn ngày" onPointerEnter={() => { loadCalendar().catch(() => {}); }} onFocus={() => { loadCalendar().catch(() => {}); }} onPointerDown={() => setKeyboard(false)} onKeyDown={() => setKeyboard(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg>
      </Popover.Trigger>
      <Popover.Portal container={input.current?.closest('dialog') || undefined}>
        <Popover.Positioner sideOffset={8} align="start" className="bloom-positioner">
          <Popover.Popup className="bloom-popup bloom-calendar" data-keyboard={keyboard}>
            <Popover.Title className="bloom-calendar-title">Chọn ngày của bạn</Popover.Title>
            <Suspense fallback={<BloomLoader compact label="Lịch Garden Dreams" />}><Calendar selected={dateObject(iso)}
              defaultMonth={dateObject(iso) || dateObject(min) || dateObject(vietnamDate())}
              disabled={[...(min ? [{ before: dateObject(min) }] : []), ...(max ? [{ after: dateObject(max) }] : [])]}
              onSelect={date => { if (date) { update(dateText(dateISO(date))); setOpen(false); } }} /></Suspense>
            <div className="bloom-calendar-actions"><button type="button" onClick={() => { update(dateText(vietnamDate())); setOpen(false); }} disabled={Boolean(min && vietnamDate()<min || max && vietnamDate()>max)}>Hôm nay</button>
              {!required && <button type="button" onClick={() => { update(''); setOpen(false); }}>Xóa ngày</button>}
              <Popover.Close>Đóng lịch</Popover.Close></div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </span>;
}
