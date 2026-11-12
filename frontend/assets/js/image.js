// Client-side image preparation: validate, fix orientation, downscale, re-encode as JPEG.
// Shrinks uploads (faster on mobile networks) and converts formats like HEIC
// where the browser can decode them. The server validates again independently.

const RAW_LIMIT_MB = 25;
const ACCEPTED = /^image\//i;

export class ImageError extends Error {}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ImageError("تعذّر قراءة الصورة. جرّب صورة بصيغة JPG أو PNG.")); };
    img.src = url;
  });
}

function draw(src, maxSide) {
  const w = src.width, h = src.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, q) => new Promise((res) => canvas.toBlob(res, "image/jpeg", q));

/**
 * @returns {Promise<{blob: Blob, previewUrl: string, thumb: string}>}
 */
export async function prepareImage(file, { maxSide = 1600, maxBytes = 8 * 1024 * 1024 } = {}) {
  if (!file) throw new ImageError("لم يتم اختيار صورة.");
  if (file.type && !ACCEPTED.test(file.type)) throw new ImageError("هذا الملف ليس صورة. اختر صورة JPG أو PNG أو WEBP.");
  if (file.size > RAW_LIMIT_MB * 1024 * 1024) throw new ImageError(`حجم الصورة كبير جدًا (الحد ${RAW_LIMIT_MB} ميغابايت قبل الضغط).`);

  const src = await decode(file);
  if (Math.min(src.width, src.height) < 64) throw new ImageError("الصورة صغيرة جدًا للتحليل.");

  const canvas = draw(src, maxSide);
  let blob = await toBlob(canvas, 0.88);
  if (blob && blob.size > maxBytes) blob = await toBlob(canvas, 0.7);
  if (!blob) throw new ImageError("تعذّر معالجة الصورة على هذا الجهاز.");
  if (blob.size > maxBytes) throw new ImageError("حجم الصورة كبير جدًا حتى بعد الضغط.");

  const thumb = draw(src, 320).toDataURL("image/jpeg", 0.72);
  if (src.close) src.close();
  return { blob, previewUrl: URL.createObjectURL(blob), thumb };
}
