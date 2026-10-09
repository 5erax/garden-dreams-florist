import { useState } from "react";
import { backend, backendError, verifyEnvironment } from "./backend.js";
import { useStore } from "./Store.jsx";
import { albumLimit, prepareProductImage } from "./product-images.js";

export default function ProductPhotosEditor({ images, onChange, onBusyChange }) {
  const store = useStore();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  async function upload(event) {
    const files = [...event.currentTarget.files];
    event.currentTarget.value = "";
    if (!files.length) return;
    setError("");
    if (images.length + files.length > albumLimit) {
      setError("Mỗi bó hoa có tối đa 8 ảnh. Chọn ít ảnh hơn hoặc bỏ bớt ảnh trong album.");
      return;
    }
    onBusyChange(true);
    let next = [...images];
    try {
      const runtime = await verifyEnvironment();
      if (!store.isAdmin || !store.session || !runtime.features?.productImageUpload)
        throw new Error("Upload ảnh chưa sẵn sàng. Tải lại sau khi cửa hàng cấu hình xong.");
      for (const [index, file] of files.entries()) {
        setProgress(`Đang xử lý ảnh ${index + 1}/${files.length}…`);
        const blob = await prepareProductImage(file);
        const path = `products/${store.session.user.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await backend.storage.from("gd-product-images").upload(path, blob, {
          upsert: false, contentType: "image/webp", cacheControl: "31536000",
        });
        if (uploadError) throw new Error(backendError(uploadError));
        const { data } = backend.storage.from("gd-product-images").getPublicUrl(path);
        next = [...next, data.publicUrl];
        onChange(next);
      }
      setProgress("Đã tải ảnh lên. Lưu thay đổi để cập nhật album cho khách.");
    } catch (e) {
      setProgress("");
      setError(e instanceof Error ? e.message : "Chưa xử lý được ảnh. Thử lại với ảnh khác.");
    } finally { onBusyChange(false); }
  }
  function move(index, direction) {
    const next = [...images];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  // shortcut: retain unreferenced uploads, add cleanup after order/memory image references are indexed.
  return (
    <section className="product-photos-editor" aria-label="Album ảnh bó hoa">
      <h4>Album ảnh</h4>
      <p className="fineprint">Ảnh đầu tiên là ảnh bìa. Bỏ ảnh chỉ thay đổi album; ảnh trên đơn đã đặt được giữ lại.</p>
      {images.length > 0 && <ol className="product-photo-list">
        {images.map((src, index) => <li key={src}>
          <img src={src} alt={`Ảnh ${index + 1} của bó hoa`} loading="lazy" decoding="async" />
          <span>{index === 0 ? "Ảnh bìa" : `Ảnh ${index + 1}`}</span>
          <div>
            <button type="button" disabled={index === 0} aria-label={`Đưa ảnh ${index + 1} lên trước`} onClick={() => move(index, -1)}>←</button>
            <button type="button" disabled={index === images.length - 1} aria-label={`Đưa ảnh ${index + 1} về sau`} onClick={() => move(index, 1)}>→</button>
            <button type="button" aria-label={`Bỏ ảnh ${index + 1} khỏi album`} onClick={() => onChange(images.filter((_, i) => i !== index))}>Bỏ ảnh</button>
          </div>
        </li>)}
      </ol>}
      {!images.length && <p className="fineprint">Album trống: bó hoa dùng ảnh bìa dự phòng bên trên.</p>}
      {store.features.productImageUpload ? <label>
        Thêm ảnh ({images.length}/{albumLimit})
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={images.length >= albumLimit} onChange={upload} />
        <span className="fineprint">JPEG, PNG, WebP · tối đa 20 MB/ảnh. Ảnh được thu nhỏ và nén trước khi tải lên.</span>
      </label> : <p className="fineprint">Upload chưa được kết nối. Bạn vẫn có thể sắp xếp album hiện có.</p>}
      {progress && <p role="status">{progress}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
