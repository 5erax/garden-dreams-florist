import { cartChoice, cartKey, subtotal } from './order.js';
import { money } from './catalog.js';
export default function CartSummary({ cart, products, onEdit }) {
  return <aside className="gate-summary" aria-label="Bó hoa đang đặt">
    <h3>Bó hoa bạn đã chọn</h3>
    {cart.map(line => { const choice = cartChoice(line,products); return choice && <p key={cartKey(line)}><span>{choice.name}{choice.sizeName ? ` · ${choice.sizeName}` : ''} × {line.quantity}</span><strong>{money(choice.price * line.quantity)}</strong></p>; })}
    <p><span>Tạm tính</span><strong>{money(subtotal(cart,products))}</strong></p>
    <small>Chưa gồm phí giao; tổng tiền hiển thị sau khi chọn khu vực.</small>
    <button className="text-button" onClick={onEdit}>Sửa giỏ hoa</button>
  </aside>;
}
