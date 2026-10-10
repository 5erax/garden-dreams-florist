import { DayPicker } from '@daypicker/react';
import { vi } from '@daypicker/react/locale';
export default function BloomCalendar(props) {
  return <DayPicker {...props} mode="single" locale={vi} weekStartsOn={1} autoFocus />;
}
