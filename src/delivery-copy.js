import { money } from './catalog.js';
export function deliveryCopy(shipping = []) {
  return shipping.length ? shipping.map(zone => `${zone.name}: ${zone.fee === 0 ? 'miễn phí' : money(zone.fee)}`).join(' · ')
    : 'Miễn phí trong Long Thành · Ngoài khu vực: 30.000 ₫ · Khu vực xa hơn: 50.000 ₫';
}
