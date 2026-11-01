/**
 * Three SYNTHETIC sample prescriptions. Every name is fake and every image is
 * watermarked "SAMPLE". No real patient or doctor data is used anywhere.
 *
 * `extracted` is what a good AI read of the image would return. It is used:
 *  - by `scripts/make-samples.mjs` to draw the images in /public/samples, and
 *  - as the pre-saved result for Demo mode, so a stage demo never breaks if the
 *    AI is slow or offline (Milestone 5).
 *
 * Plain relative imports only, so the script can load this file with Node directly.
 */
import type { ExtractedPrescription } from "./schema";

export type SampleStyle = "typed" | "neat" | "messy";

export interface SamplePrescription {
  id: string;
  style: SampleStyle;
  titleTl: string;
  titleEn: string;
  descriptionTl: string;
  descriptionEn: string;
  /** Path under /public. */
  image: string;
  extracted: ExtractedPrescription;
}

export const SAMPLES: SamplePrescription[] = [
  {
    id: "sample-1-typed",
    style: "typed",
    titleTl: "Sample 1: Naka-type",
    titleEn: "Sample 1: Typed",
    descriptionTl: "Malinaw na naka-print na reseta. Karamihan ng linya ay madaling mabasa.",
    descriptionEn: "A clearly printed prescription. Most lines are easy to read.",
    image: "/samples/sample-1-typed.png",
    extracted: {
      doctor: { name: "Dr. Sample Reyes, MD", clinic: "SAMPLE Clinic (hindi totoo)", license_no: "SAMPLE-0000" },
      patient: { name: "Juan SAMPLE Dela Cruz", age: "68" },
      date: "2026-10-15",
      medicines: [
        {
          raw_text: "Losartan 50 mg tablet #30",
          generic_name: "Losartan",
          brand_name: "",
          strength: "50 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab OD in the morning, maintenance",
          confidence: { generic_name: 0.98, strength: 0.98, sig_raw: 0.97 },
        },
        {
          raw_text: "Amlodipine 5 mg tablet #30",
          generic_name: "Amlodipine",
          brand_name: "",
          strength: "5 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab OD in the morning, maintenance",
          confidence: { generic_name: 0.98, strength: 0.98, sig_raw: 0.97 },
        },
        {
          raw_text: "Metformin 500 mg tablet #60",
          generic_name: "Metformin",
          brand_name: "",
          strength: "500 mg",
          dosage_form: "tablet",
          quantity: "60",
          sig_raw: "1 tab BID pc, maintenance",
          confidence: { generic_name: 0.97, strength: 0.98, sig_raw: 0.96 },
        },
        {
          raw_text: "Atorvastatin 20 mg tablet #30",
          generic_name: "Atorvastatin",
          brand_name: "",
          strength: "20 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab HS, maintenance",
          confidence: { generic_name: 0.97, strength: 0.97, sig_raw: 0.96 },
        },
        {
          raw_text: "Paracetamol 500 mg tablet #20",
          generic_name: "Paracetamol",
          brand_name: "Biogesic",
          strength: "500 mg",
          dosage_form: "tablet",
          quantity: "20",
          sig_raw: "1 tab q6h PRN for fever",
          confidence: { generic_name: 0.97, strength: 0.97, sig_raw: 0.95 },
        },
      ],
      unreadable_notes: [],
    },
  },
  {
    id: "sample-2-neat",
    style: "neat",
    titleTl: "Sample 2: Maayos na sulat-kamay",
    titleEn: "Sample 2: Neat handwriting",
    descriptionTl: "Sulat-kamay na madaling basahin. May ilang detalyeng dapat kumpirmahin.",
    descriptionEn: "Easy-to-read handwriting. A few details still need confirming.",
    image: "/samples/sample-2-neat.png",
    extracted: {
      doctor: { name: "Dra. Sample Garcia", clinic: "SAMPLE Medical Center (hindi totoo)", license_no: "SAMPLE-1111" },
      patient: { name: "Maria SAMPLE Santos", age: "74" },
      date: "10/22/2026",
      medicines: [
        {
          raw_text: "Amoxicillin susp 250 mg/5 mL",
          generic_name: "Amoxicillin",
          brand_name: "",
          strength: "250 mg/5 mL",
          dosage_form: "suspension",
          quantity: "1 bottle",
          sig_raw: "1 tsp TID x 7 days",
          confidence: { generic_name: 0.92, strength: 0.88, sig_raw: 0.9 },
        },
        {
          raw_text: "Losartan 100 mg tab",
          generic_name: "Losartan",
          brand_name: "",
          strength: "100 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab OD",
          confidence: { generic_name: 0.93, strength: 0.74, sig_raw: 0.9 },
        },
        {
          raw_text: "Metformin 500 mg tab",
          generic_name: "Metformin",
          brand_name: "",
          strength: "500 mg",
          dosage_form: "tablet",
          quantity: "60",
          sig_raw: "1 tab BID pc",
          confidence: { generic_name: 0.93, strength: 0.9, sig_raw: 0.91 },
        },
        {
          raw_text: "Paracetamol 500 mg tab",
          generic_name: "Paracetamol",
          brand_name: "",
          strength: "500 mg",
          dosage_form: "tablet",
          quantity: "20",
          sig_raw: "1 tab q6h PRN for pain",
          confidence: { generic_name: 0.94, strength: 0.92, sig_raw: 0.9 },
        },
      ],
      unreadable_notes: [],
    },
  },
  {
    id: "sample-3-messy",
    style: "messy",
    titleTl: "Sample 3: Magulong sulat-kamay",
    titleEn: "Sample 3: Messy handwriting",
    descriptionTl: "Mahirap basahin. Maraming dapat kumpirmahin, at may isang linyang hindi mabasa.",
    descriptionEn: "Hard to read. Many items need confirming, and one line cannot be read.",
    image: "/samples/sample-3-messy.png",
    extracted: {
      doctor: { name: "Dr. Sample Mendoza", clinic: "SAMPLE Clinic (hindi totoo)", license_no: "" },
      patient: { name: "Pedro SAMPLE Reyes", age: "80" },
      date: "10/28/26",
      medicines: [
        {
          raw_text: "Atorvastatin 40 mg tab",
          generic_name: "Atorvastatin",
          brand_name: "",
          strength: "40 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab HS",
          confidence: { generic_name: 0.82, strength: 0.58, sig_raw: 0.85 },
        },
        {
          raw_text: "Amlodipine 10 mg tab",
          generic_name: "Amlodipine",
          brand_name: "",
          strength: "10 mg",
          dosage_form: "tablet",
          quantity: "30",
          sig_raw: "1 tab OD",
          confidence: { generic_name: 0.86, strength: 0.7, sig_raw: 0.8 },
        },
        {
          raw_text: "Metformin 500 mg tab",
          generic_name: "Metformin",
          brand_name: "",
          strength: "500 mg",
          dosage_form: "tablet",
          quantity: "60",
          sig_raw: "1 tab BID pc",
          confidence: { generic_name: 0.84, strength: 0.85, sig_raw: 0.55 },
        },
        {
          raw_text: "Amoxicillin cap 500 mg",
          generic_name: "Amoxicillin",
          brand_name: "",
          strength: "500 mg",
          dosage_form: "capsule",
          quantity: "21",
          sig_raw: "1 cap TID x 7 days",
          confidence: { generic_name: 0.8, strength: 0.78, sig_raw: 0.83 },
        },
        {
          raw_text: "(hindi mabasa)",
          generic_name: "",
          brand_name: "",
          strength: "",
          dosage_form: "other",
          quantity: "",
          sig_raw: "",
          confidence: { generic_name: 0.1, strength: 0.1, sig_raw: 0.1 },
        },
      ],
      unreadable_notes: ["Hindi mabasa ang ikalimang linya (magulong sulat-kamay)."],
    },
  },
];

export function getSample(id: string): SamplePrescription | undefined {
  return SAMPLES.find((s) => s.id === id);
}
