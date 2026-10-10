import referenceCatalog from './reference-catalog.json' with { type: 'json' };
import { useState } from "react";
import Icon from "./Icons.jsx";
import { productPhotos } from "./product-images.js";

export default function ProductGallery({ product }) {
  const photos = productPhotos(product);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(new Set());
  const src = photos[selected] || photos[0];
  const credit = referenceCatalog.find(item => item.image === src)?.credit;
  const markFailed = (url) => setFailed(old => new Set([...old, url]));
  return <div className="product-detail-photo product-gallery">
    <div className="product-gallery-main">
      {src && !failed.has(src) ?
        <img src={src} alt={`Bó hoa ${product.name}, ảnh ${selected + 1}`} decoding="async" onError={() => markFailed(src)} /> :
        <div className="product-photo-placeholder"><Icon name="flower" /><span>Ảnh đang cập nhật</span></div>}
    </div>
    {credit && <p className="photo-credit">Ảnh tham khảo · <a href={credit.source} target="_blank" rel="noreferrer">{credit.author || "Wikimedia Commons"}</a> · <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>. Ảnh không phải bó hoa thực tế của shop.</p>}
    {src?.endsWith('-pending.svg') && <p className="photo-pending">Ảnh thực tế của mẫu này đang cập nhật. Hình đang hiển thị là nhãn giữ chỗ, không phải ảnh bó hoa.</p>}
    {photos.length > 1 && <>
      <div className="product-gallery-thumbnails" aria-label="Chọn ảnh bó hoa">
        {photos.map((photo, index) => <button key={photo} type="button" aria-label={`Xem ảnh ${index + 1} của ${product.name}`}
          aria-pressed={selected === index} onClick={() => setSelected(index)}>
          {!failed.has(photo) ? <img src={photo} alt="" loading="lazy" decoding="async" onError={() => markFailed(photo)} /> : <Icon name="flower" />}
        </button>)}
      </div>
      <p className="product-gallery-counter" aria-live="polite">Ảnh {selected + 1}/{photos.length}</p>
    </>}
  </div>;
}
