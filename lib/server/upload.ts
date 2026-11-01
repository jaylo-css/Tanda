import { createHash } from "node:crypto";
import { AI_CONFIG } from "../ai/config";
import type { ImageInput } from "../ai/provider";
import { SAMPLE_HASHES } from "../sample-hashes";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export class UploadError extends Error {
  constructor(
    public readonly code: "bad_image" | "too_large" | "no_file",
    public readonly tl: string,
    public readonly en: string,
  ) {
    super(en);
  }
}

export interface ParsedUpload {
  image: ImageInput;
  bytes: number;
  /** Set only when the bytes are exactly one of our synthetic sample images. */
  sampleId: string | null;
}

/**
 * Reads and validates the "image" field of a multipart request. The image is held in memory
 * only: nothing is written to disk or a database (privacy: no prescription photos are stored).
 */
export async function readImageUpload(req: Request): Promise<ParsedUpload> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new UploadError("no_file", "Walang natanggap na litrato.", "No photo was received.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) throw new UploadError("no_file", "Walang natanggap na litrato.", "No photo was received.");
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
    throw new UploadError("bad_image", "JPG, PNG o WebP lang ang tinatanggap dito.", "Only JPG, PNG or WebP photos are accepted here.");
  }
  if (file.size > AI_CONFIG.limits.maxImageBytes) {
    throw new UploadError("too_large", "Masyadong malaki ang litrato.", "The photo is too large.");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  return {
    image: { mimeType: file.type, base64: buf.toString("base64") },
    bytes: buf.length,
    sampleId: SAMPLE_HASHES[hash] ?? null,
  };
}
