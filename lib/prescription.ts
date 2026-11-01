/**
 * The finished, human-confirmed prescription: the single shape used by the large-print result
 * page, the printable card, and the family share page.
 * It holds only what the reviewer confirmed. No photo of the prescription, and no AI text.
 */
import type { Header, Role } from "@/components/SessionProvider";
import { toDisplay, type DisplayMedicine, type MedicineEntry } from "./review";

export interface PrescriptionData {
  patientName: string;
  patientAge: string;
  doctorName: string;
  clinic: string;
  /** Date written on the prescription, as written. */
  prescriptionDate: string;
  reviewerName: string;
  reviewerRole: Role;
  /** ISO time when the reviewer finalised. */
  checkedAt: string;
  medicines: DisplayMedicine[];
}

export function buildPrescriptionData(args: {
  header: Header;
  reviewer: { name: string; role: Role };
  entries: MedicineEntry[];
  finalizedAt: string;
}): PrescriptionData {
  return {
    patientName: args.header.patient.name.trim(),
    patientAge: args.header.patient.age.trim(),
    doctorName: args.header.doctor.name.trim(),
    clinic: args.header.doctor.clinic.trim(),
    prescriptionDate: args.header.date.trim(),
    reviewerName: args.reviewer.name.trim(),
    reviewerRole: args.reviewer.role,
    checkedAt: args.finalizedAt,
    medicines: args.entries.map(toDisplay),
  };
}

/** "2 Nob 2026" in Tagalog or English, from an ISO string. Falls back to the raw text. */
export function formatDate(iso: string, lang: "tl" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tl = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];
  const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${(lang === "tl" ? tl : en)[d.getMonth()]} ${d.getFullYear()}`;
}
