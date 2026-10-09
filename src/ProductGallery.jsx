import { useState } from "react";
import Icon from "./Icons.jsx";
import { productPhotos } from "./product-images.js";

export default function ProductGallery({ product }) {
  const photos = productPhotos(product);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(new Set());
  const src = photos[selected] || photos[0];
  const markFailed = (url) => setFailed(old => new Set([...old, url]));
  return <div className="product-detail-photo product-gallery">
    <div className="product-gallery-main">
      {src && !failed.has(src) ?
        <img src={src} alt={`Bó hoa ${product.name}, ảnh ${selected + 1}`} decoding="async" onError={() => markFailed(src)} /> :
        <div className="product-photo-placeholder"><Icon name="flower" /><span>Ảnh đang cập nhật</span></div>}
    </div>
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
