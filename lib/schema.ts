import { z } from "zod";

/**
 * Shape the vision model must return for a prescription.
 * Validated with zod: anything else is rejected (the route retries once, then
 * shows a friendly error with the option to type the medicines by hand).
 */

export const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "inhaler",
  "drops",
  "cream",
  "injection",
  "other",
] as const;
export type DosageForm = (typeof DOSAGE_FORMS)[number];

/** Confidence below this is shown in amber and must be confirmed by a human. */
export const CONFIDENCE_THRESHOLD = 0.8;

const text = z.string().default("");

/** Models sometimes answer a dosage form we don't list; coerce to "other", never reject the whole read. */
const dosageForm = z
  .string()
  .default("other")
  .transform((v): DosageForm => {
    const x = v.trim().toLowerCase();
    return (DOSAGE_FORMS as readonly string[]).includes(x) ? (x as DosageForm) : "other";
  });

const confidence01 = z.number().min(0).max(1);

export const extractedMedicineSchema = z.object({
  raw_text: text,
  generic_name: text,
  brand_name: text,
  strength: text,
  dosage_form: dosageForm,
  quantity: text,
  sig_raw: text,
  confidence: z.object({
    generic_name: confidence01,
    strength: confidence01,
    sig_raw: confidence01,
  }),
});

export const extractedPrescriptionSchema = z.object({
  doctor: z
    .object({ name: text, clinic: text, license_no: text })
    .default({ name: "", clinic: "", license_no: "" }),
  patient: z.object({ name: text, age: text }).default({ name: "", age: "" }),
  date: text,
  medicines: z.array(extractedMedicineSchema),
  unreadable_notes: z.array(z.string()).default([]),
});

/** What the model reads from the PRINTED label of a medicine box / bottle / blister pack. */
export const boxLabelSchema = z.object({
  generic_name: text,
  brand_name: text,
  strength: text,
  dosage_form: dosageForm,
  confidence: z.object({ generic_name: confidence01, strength: confidence01 }),
});
export type BoxLabel = z.infer<typeof boxLabelSchema>;

export type ExtractedMedicine = z.infer<typeof extractedMedicineSchema>;
export type ExtractedPrescription = z.infer<typeof extractedPrescriptionSchema>;
