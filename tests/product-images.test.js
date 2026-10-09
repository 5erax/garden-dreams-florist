import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImage, imageDimensions, productPhotos, prepareProductImage } from "../src/product-images.js";

test("image validation rejects spoofed MIME, SVG and oversize files; resizing preserves shape", () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  validateImage({ type: "image/png", size: 12 }, png);
  validateImage({ type: "image/jpeg", size: 5000 }, Uint8Array.from([255, 216, 255]));
  validateImage({ type: "image/webp", size: 5000 }, new TextEncoder().encode("RIFF0000WEBP"));
  for (const file of [{ type: "image/svg+xml", size: 5000 }, { type: "image/jpeg", size: 5000 },
    { type: "image/png", size: 21 * 1024 * 1024 }, { type: "image/png", size: 0 }])
    assert.throws(() => validateImage(file, png), /JPEG/);
  assert.deepEqual(imageDimensions(4000, 3000), [1600, 1200]);
  assert.deepEqual(imageDimensions(3000, 6000), [800, 1600]);
  assert.deepEqual(imageDimensions(300, 200), [300, 200]);
  assert.deepEqual(imageDimensions(1, 10000), [1, 1600]);
  for (const dimensions of [[0, 100], [-1, 100], [1.5, 100], [Infinity, 2], [8000, 8000]])
    assert.throws(() => imageDimensions(...dimensions), /32 megapixel/);
});
test("gallery prefers ordered album and keeps a legacy cover or an empty placeholder", () => {
  assert.deepEqual(productPhotos({ images: ["a", "b"], image: "legacy" }), ["a", "b"]);
  assert.deepEqual(productPhotos({ images: [], image: "legacy" }), ["legacy"]);
  assert.deepEqual(productPhotos({}), []);
  assert.equal(productPhotos({ images: Array(12).fill("a") }).length, 8);
});
test("encoding retries once for size, rejects unsupported output and releases decoded resources", async () => {
  const previousDocument = globalThis.document;
  const previousBitmap = globalThis.createImageBitmap;
  const file = new Blob([Uint8Array.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: "image/jpeg" });
  let closed = 0;
  let qualities = [];
  let outputs;
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
    toBlob(callback, type, quality) { assert.equal(type, "image/webp"); qualities.push(quality); callback(outputs.shift()); } };
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() { closed++; } });
  try {
    outputs = [{ type: "image/webp", size: 3 * 1024 * 1024 }, { type: "image/webp", size: 1000 }];
    assert.equal((await prepareProductImage(file)).size, 1000);
    assert.deepEqual(qualities, [0.85, 0.65]);
    assert.equal(closed, 1);
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
    for (const output of [null, { type: "image/png", size: 100 }, { type: "image/webp", size: 3 * 1024 * 1024 }]) {
      outputs = [output, output];
      await assert.rejects(prepareProductImage(file), /2 MB/);
    }
    assert.equal(closed, 4);
    globalThis.createImageBitmap = async () => { throw new Error("decoder error"); };
    await assert.rejects(prepareProductImage(file), /Không đọc được ảnh/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = previousBitmap;
  }
});
