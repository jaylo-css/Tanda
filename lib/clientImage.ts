/**
 * Browser-side image preparation: JPG/PNG/HEIC in, a resized JPEG out (max 2000 px by default).
 * Runs on the user's device so a smaller photo is sent. Nothing is stored.
 */

export const MAX_UPLOAD_DIMENSION = 2000;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Scales (w, h) down so the longest side is at most `max`. Never scales up. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export function isHeic(file: Blob & { name?: string }): boolean {
  return /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name ?? "");
}

export class ImageError extends Error {
  constructor(public readonly kind: "heic" | "decode") {
    super(kind);
  }
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // older browsers: fall back to an <img> element
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new ImageError("decode");
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError("decode"))), "image/jpeg", quality),
  );
}

/** Converts HEIC/HEIF to JPEG (loaded on demand: the library is large). */
async function heicToJpeg(file: Blob): Promise<Blob> {
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return Array.isArray(out) ? out[0] : out;
  } catch {
    throw new ImageError("heic");
  }
}

export async function prepareImage(
  file: Blob & { name?: string },
  maxDimension = MAX_UPLOAD_DIMENSION,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<Blob> {
  const blob = isHeic(file) ? await heicToJpeg(file) : file;
  const img = await decode(blob);
  try {
    let dim = maxDimension;
    let quality = 0.85;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { width, height } = fitWithin(img.width, img.height, dim);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageError("decode");
      ctx.fillStyle = "#ffffff"; // PNG transparency -> white, not black
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img.source, 0, 0, width, height);
      const out = await toJpeg(canvas, quality);
      if (out.size <= maxBytes) return out;
      dim = Math.round(dim * 0.8);
      quality = Math.max(0.6, quality - 0.08);
    }
    throw new ImageError("decode");
  } finally {
    img.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new ImageError("decode"));
    r.readAsDataURL(blob);
  });
}
