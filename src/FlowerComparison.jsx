import { Modal } from './ShopDialogs.jsx';
import { money } from './catalog.js';
import { productUrl } from './product-url.js';
import './flower-selection.css';
import ProductGallery from './ProductGallery.jsx';

export default function FlowerComparison({ products, onClose, onChoose, onRemove }) {
  return <Modal title="So sánh những bó hoa" onClose={onClose} className="flower-comparison">
    <span className="eyebrow">CHỌN MỘT LỜI THƯƠNG</span><h2>Đặt những bó hoa cạnh nhau.</h2>
    <p>So sánh tối đa ba mẫu. Giá dưới đây chưa gồm phí giao; mở mẫu để chọn cỡ bó.</p>
    <div className="comparison-grid">{products.map(p => <article key={p.id}>
      <ProductGallery product={p} />
      <h3>{p.name}</h3><p>{p.occasion || 'Hoa tặng'}</p>
      <strong>{money(p.price)}</strong><small>{p.reference_only ? 'Giá dự kiến · chưa bán' : 'Giá cỡ tiêu chuẩn'}</small>
      <p>{p.stems}</p><p>{p.description}</p>
      <button className="button primary" onClick={() => onChoose(p)}>Xem & chọn mẫu</button>
      <a href={productUrl(p)}>Trang riêng của bó hoa ↗</a>
      <button className="text-button" onClick={() => onRemove(p.id)}>Bỏ {p.name} khỏi so sánh</button>
    </article>)}</div>
    {!products.length && <p>Chọn bó hoa trong bộ sưu tập để so sánh.</p>}
  </Modal>;
}
