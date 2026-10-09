export const albumLimit = 8;
const sourceLimit = 20 * 1024 * 1024;
const uploadLimit = 2 * 1024 * 1024;
export function validateImage(file, header) {
  const bytes = new Uint8Array(header);
  const signature = {
    "image/jpeg": bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    "image/png": [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n),
    "image/webp": String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  };
  if (!Number.isFinite(file.size) || file.size < 12 || file.size > sourceLimit || !signature[file.type])
    throw new Error("Chọn ảnh JPEG, PNG hoặc WebP hợp lệ, tối đa 20 MB mỗi ảnh.");
}
export function imageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 32000000)
    throw new Error("Ảnh quá lớn hoặc không đọc được. Chọn ảnh tối đa 32 megapixel.");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}
export async function prepareProductImage(file) {
  validateImage(file, await file.slice(0, 12).arrayBuffer());
  let bitmap;
  const canvas = document.createElement("canvas");
  try {
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error("Không đọc được ảnh. Chọn ảnh khác hoặc dùng trình duyệt mới hơn."); }
    [canvas.width, canvas.height] = imageDimensions(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt chưa hỗ trợ xử lý ảnh. Thử trình duyệt mới hơn.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality) => new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    let blob = await encode(0.85);
    if (blob?.size > uploadLimit) blob = await encode(0.65);
    if (!blob || blob.type !== "image/webp" || blob.size > uploadLimit)
      throw new Error("Chưa nén được ảnh dưới 2 MB. Chọn ảnh nhỏ hơn hoặc trình duyệt mới hơn.");
    return blob;
  } finally {
    bitmap?.close();
    canvas.width = canvas.height = 0;
  }
}
export function productPhotos(product) {
  return product.images?.length ? product.images.slice(0, albumLimit) : product.image ? [product.image] : [];
}
