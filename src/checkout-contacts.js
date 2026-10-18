export const normalizePhone = value => typeof value === 'string' ? value.replace(/[\s().-]/g, '') : '';
export function checkoutContacts(raw) {
  const values = {...raw, buyerPhone:normalizePhone(raw.buyerPhone), phone:normalizePhone(raw.phone)};
  const errors = {};
  for (const [field,label] of [['buyerPhone','người đặt'],['phone','người nhận']]) {
    if (!/^(?:0|\+84)[35789]\d{8}$/.test(values[field])) errors[field] = `Điện thoại ${label} chưa hợp lệ. Nhập số Việt Nam bắt đầu bằng 0 hoặc +84.`;
  }
  return {values,errors};
}
