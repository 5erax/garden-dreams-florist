import Icon from './Icons.jsx';
import { money } from './catalog.js';
import { cartChoice } from './order.js';

export default function FlowerCard({ product, tone, favorite, compared, comparisonFull, onView, onAdd, onFavorite, onCompare }) {
  const available = Boolean(cartChoice({ id: product.id }, [product]));
  return <article className="product-card">
    <div className={`product-image tone-${tone}`}>
      <button className="product-open" onClick={onView} aria-label={`Xem chi tiết ${product.name}`}>
        <img src={product.image} alt={`Bó hoa ${product.name}`} loading="lazy" width="600" height="700" />
      </button>
    </div>
    <div className="product-copy">
      <div className="product-card-meta"><span className="eyebrow">{product.occasion}</span>
        <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={`${favorite ? 'Bỏ lưu' : 'Lưu'} ${product.name}`} aria-pressed={favorite} onClick={onFavorite}><Icon name="heart" /></button>
      </div>
      {product.featured&&<span className="product-featured">Mẫu nổi bật</span>}{!available && <span className="product-availability">Chưa nhận đặt</span>}
      <h3><button onClick={onView}>{product.name}</button></h3>
      <div className="product-details"><span>{product.stems?.replace(/hoa phụ/gi, 'hoa nhỏ phối cùng')}</span>
        <div className="product-price"><span>{product.variants?.some(v=>v.active)?'Từ ':''}{product.reference_only ? 'Giá dự kiến' : 'Giá mỗi bó'}</span><strong>{money(Math.min(product.price,...(product.variants||[]).filter(v=>v.active).map(v=>v.price)))}</strong></div>
      </div>
      <div className="product-card-actions">
        <button className="button outline card-add" disabled={!available} onClick={product.variants?.length ? onView : onAdd} aria-label={`${product.variants?.length ? 'Chọn cỡ' : 'Thêm vào giỏ hoa'} ${product.name}`}>
          {available ? product.variants?.length ? 'Chọn cỡ bó' : 'Thêm vào giỏ hoa' : 'Chưa nhận đặt'}<Icon name="plus" />
        </button>
        {!available && <button className="text-button" onClick={onView}>Xem mẫu hoa</button>}
        <label className="compare-choice"><input type="checkbox" checked={compared} disabled={!compared && comparisonFull} onChange={onCompare} />So sánh<span className="sr-only"> {product.name}</span></label>
      </div>
    </div>
  </article>;
}
