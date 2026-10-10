export function dateObject(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return undefined;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(12, 0, 0, 0);
  return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}
export function dateISO(date) {
  return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function dateText(iso) {
  return dateObject(iso) ? iso.split('-').reverse().join('/') : '';
}
export function dateFromText(text) {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : '';
  return dateObject(iso) ? iso : '';
}
