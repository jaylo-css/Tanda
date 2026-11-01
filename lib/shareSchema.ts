/**
 * What a family share link stores. Data minimisation (Data Privacy Act): ONLY the confirmed clear
 * version, i.e. display text for each medicine and the user's own medicine photos.
 * Not stored: the prescription photo, the doctor's licence number, the AI's raw reading,
 * confidence scores, or the written shorthand.
 */
import { z } from "zod";
import { DOSAGE_FORMS } from "./schema";
import type { PrescriptionData } from "./prescription";
import type { DisplayMedicine } from "./review";

const str = (max: number) => z.string().max(max);

const medicineSchema = z.object({
  id: str(64).regex(/^[A-Za-z0-9_-]+$/),
  name: str(200).nullable(),
  brand: str(200),
  strength: str(100),
  form: z.enum(DOSAGE_FORMS),
  tagalog: str(1000),
  english: str(1000),
  doseTl: str(100),
  doseEn: str(100),
  slots: z.array(z.enum(["umaga", "tanghali", "hapon", "gabi", "bago_matulog"])).max(5),
  timing: z.enum(["AC", "PC", "WITH_MEALS", "EMPTY_STOMACH"]).nullable(),
  prn: z.boolean(),
  paraSaan: str(500),
  amount: z
    .object({
      min: z.number().min(0).max(1000),
      max: z.number().min(0).max(1000).optional(),
      unit: z.enum(["tablet", "capsule", "tsp", "tbsp", "ml", "drop", "puff", "unit", "sachet", "ampule"]).nullable(),
    })
    .nullable(),
  boxWarnings: z
    .array(
      z.object({
        kind: z.enum(["strength", "name", "strength_unknown"]),
        severity: z.enum(["danger", "caution"]),
        tl: str(400),
        en: str(400),
      }),
    )
    .max(3),
});

export const sharedDataSchema = z.object({
  patientName: str(200),
  patientAge: str(20),
  doctorName: str(200),
  clinic: str(200),
  prescriptionDate: str(60),
  reviewerName: str(200),
  reviewerRole: z.enum(["", "pasyente", "kapamilya", "pharmacist"]),
  checkedAt: str(40),
  medicines: z.array(medicineSchema).min(1).max(30),
});

export const MAX_PHOTO_BYTES = 512 * 1024;
export const MAX_TOTAL_PHOTO_BYTES = 3 * 1024 * 1024;

export const sharePayloadSchema = z.object({
  data: sharedDataSchema,
  /** medicine id -> data URL of the user's own photo of the box. */
  photos: z.record(z.string().regex(/^[A-Za-z0-9_-]+$/).max(64), z.string().max(Math.ceil(MAX_PHOTO_BYTES * 1.4))),
});

export type SharedData = z.infer<typeof sharedDataSchema>;
export type SharePayload = z.infer<typeof sharePayloadSchema>;

export function toSharePayload(data: PrescriptionData): SharePayload {
  const photos: Record<string, string> = {};
  const medicines = data.medicines.map((m) => {
    if (m.photoUrl) photos[m.id] = m.photoUrl;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- these two are deliberately left out of what is shared
    const { photoUrl, hasPhoto, ...rest } = m;
    return rest;
  });
  return { data: { ...data, medicines }, photos };
}

/** Rebuilds the display data for the share page from stored data + short-lived signed photo URLs. */
export function fromShared(data: SharedData, photoUrls: Record<string, string>): PrescriptionData {
  return {
    ...data,
    medicines: data.medicines.map(
      (m): DisplayMedicine => ({
        ...m,
        amount: m.amount ? { min: m.amount.min, ...(m.amount.max !== undefined ? { max: m.amount.max } : {}), unit: m.amount.unit } : null,
        hasPhoto: !!photoUrls[m.id],
        photoUrl: photoUrls[m.id] ?? null,
      }),
    ),
  };
}

export interface DecodedPhoto {
  medId: string;
  ext: "jpg" | "png" | "webp";
  mime: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
}

/** Decodes and verifies the photos: right type (by magic bytes, not just the label), size limits. */
export function decodePhotos(photos: Record<string, string>): DecodedPhoto[] | { error: string } {
  const out: DecodedPhoto[] = [];
  let total = 0;
  for (const [medId, url] of Object.entries(photos)) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!m) return { error: "photo is not a jpeg/png/webp data URL" };
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return { error: "photo too large" };
    total += bytes.length;
    if (total > MAX_TOTAL_PHOTO_BYTES) return { error: "photos too large in total" };
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    const kind = m[1] === "jpeg" && isJpeg ? "jpg" : m[1] === "png" && isPng ? "png" : m[1] === "webp" && isWebp ? "webp" : null;
    if (!kind) return { error: "photo content does not match its type" };
    out.push({ medId, ext: kind, mime: kind === "jpg" ? "image/jpeg" : kind === "png" ? "image/png" : "image/webp", bytes });
  }
  return out;
}
