/**
 * The review model: one editable "line" per medicine, and the gate that decides
 * whether the clear version may be finalised.
 *
 * SAFETY (non-negotiable, enforced here and covered by tests):
 *  - The AI only drafts. Nothing becomes final until a human has confirmed every line.
 *  - Fields with confidence < 0.8, empty fields, and anything the sig parser flagged are
 *    AMBER. Each amber field must be confirmed (tap ✓) or edited.
 *  - "Final" is blocked while any amber field is unconfirmed OR any line is unconfirmed.
 *  - "para saan" is ONLY ever what the reviewer typed. It is never filled in by code or AI.
 */
import { boxWarnings } from "./boxmatch";
import { CONFIDENCE_THRESHOLD, type DosageForm, type ExtractedMedicine } from "./schema";
import {
  composeSig,
  formatAmount,
  type Amount,
  parseSig,
  SLOT_IDS,
  UNREADABLE_EN,
  UNREADABLE_TL,
  type Duration,
  type Lang,
  type ParsedSig,
  type SlotId,
  type Timing,
} from "./sig";

export type AmberKey = "name" | "strength" | "instructions" | "slots";

export interface BoxWarning {
  kind: "strength" | "name" | "strength_unknown";
  /** danger = red (a real difference); caution = amber (could not compare). */
  severity: "danger" | "caution";
  tl: string;
  en: string;
}

export interface BoxCheck {
  /** Text read from the printed box label (suggestion only; the AI never decides the match). */
  label: { generic_name: string; brand_name: string; strength: string };
  /** The person confirmed this box matches this prescription line. */
  confirmedByUser: boolean;
  warnings: BoxWarning[];
}

export interface MedicinePhoto {
  /** A real photo the user took of the actual box / bottle / blister pack (resized, in memory). */
  dataUrl: string;
  box?: BoxCheck;
}

export interface MedicineEntry {
  id: string;
  genericName: string;
  brandName: string;
  strength: string;
  dosageForm: DosageForm;
  quantity: string;
  /** Directions exactly as written / as the reviewer corrected them. */
  sigRaw: string;
  /** Structured parse of sigRaw; slots, timing and duration may be edited by the reviewer. */
  sig: ParsedSig;
  /** Reviewer's own Tagalog wording, if they replaced the generated sentence. */
  tagalogOverride: string | null;
  /** ONLY what the reviewer typed. Never auto-filled. */
  paraSaan: string;
  confidence: ExtractedMedicine["confidence"];
  confirmed: Partial<Record<AmberKey, boolean>>;
  lineConfirmed: boolean;
  photo: MedicinePhoto | null;
  /** True for lines added by hand (no AI reading). */
  manual: boolean;
}

// ---------------------------------------------------------------------------
// Creating entries
// ---------------------------------------------------------------------------

function parseFor(sigRaw: string, form: DosageForm, generic: string, brand: string): ParsedSig {
  return parseSig(sigRaw, { dosageForm: form, ignoreWords: [generic, brand].filter(Boolean) });
}

export function entryFromExtracted(m: ExtractedMedicine, id: string): MedicineEntry {
  return {
    id,
    genericName: m.generic_name.trim(),
    brandName: m.brand_name.trim(),
    strength: m.strength.trim(),
    dosageForm: m.dosage_form,
    quantity: m.quantity.trim(),
    sigRaw: m.sig_raw.trim(),
    sig: parseFor(m.sig_raw, m.dosage_form, m.generic_name, m.brand_name),
    tagalogOverride: null,
    paraSaan: "", // never from AI or the prescription parser
    confidence: { ...m.confidence },
    confirmed: {},
    lineConfirmed: false,
    photo: null,
    manual: false,
  };
}

/** A line typed in by hand: nothing is pre-filled, so every field starts amber. */
export function blankEntry(id: string): MedicineEntry {
  return {
    id,
    genericName: "",
    brandName: "",
    strength: "",
    dosageForm: "tablet",
    quantity: "",
    sigRaw: "",
    sig: parseFor("", "tablet", "", ""),
    tagalogOverride: null,
    paraSaan: "",
    confidence: { generic_name: 0, strength: 0, sig_raw: 0 },
    confirmed: {},
    lineConfirmed: false,
    photo: null,
    manual: true,
  };
}

// ---------------------------------------------------------------------------
// Amber logic
// ---------------------------------------------------------------------------

export function computeAmberKeys(e: MedicineEntry): AmberKey[] {
  const keys: AmberKey[] = [];
  if (!e.genericName.trim() || e.confidence.generic_name < CONFIDENCE_THRESHOLD) keys.push("name");
  if (!e.strength.trim() || e.confidence.strength < CONFIDENCE_THRESHOLD) keys.push("strength");
  if (
    !e.sigRaw.trim() ||
    e.confidence.sig_raw < CONFIDENCE_THRESHOLD ||
    e.sig.flags.some((f) => f.field !== "slots")
  ) {
    keys.push("instructions");
  }
  if (e.sig.flags.some((f) => f.field === "slots")) keys.push("slots");
  return keys;
}

/** Amber fields the human has not yet confirmed or edited. */
export function pendingAmber(e: MedicineEntry): AmberKey[] {
  return computeAmberKeys(e).filter((k) => !e.confirmed[k]);
}

export function isAmber(e: MedicineEntry, key: AmberKey): boolean {
  return computeAmberKeys(e).includes(key);
}

// ---------------------------------------------------------------------------
// Edits. Every edit un-confirms the line: the human must look at the final state.
// ---------------------------------------------------------------------------

function touched(e: MedicineEntry): MedicineEntry {
  return { ...e, lineConfirmed: false };
}

export function recompose(sig: ParsedSig): ParsedSig {
  const nothing =
    !sig.amount && !sig.frequency && !sig.timing && !sig.route && !sig.duration && !sig.prn && sig.slots.length === 0;
  return {
    ...sig,
    tagalog: nothing ? UNREADABLE_TL : composeSig(sig, "tl"),
    english: nothing ? UNREADABLE_EN : composeSig(sig, "en"),
  };
}

export type TextField = "genericName" | "brandName" | "strength" | "quantity";

export function editText(e: MedicineEntry, field: TextField, value: string): MedicineEntry {
  const next = touched({ ...e, [field]: value });
  const nonEmpty = value.trim() !== "";
  if (field === "genericName") {
    next.confidence = { ...e.confidence, generic_name: nonEmpty ? 1 : 0 };
    next.confirmed = { ...e.confirmed, name: nonEmpty };
  } else if (field === "strength") {
    next.confidence = { ...e.confidence, strength: nonEmpty ? 1 : 0 };
    next.confirmed = { ...e.confirmed, strength: nonEmpty };
  }
  // if a box photo is attached, its warnings must follow the corrected name/strength
  if (next.photo?.box && (field === "genericName" || field === "brandName" || field === "strength")) {
    next.photo = { ...next.photo, box: { ...next.photo.box, warnings: boxWarnings(next.photo.box.label, next) } };
  }
  return next;
}

export function editForm(e: MedicineEntry, form: DosageForm): MedicineEntry {
  const next = touched({ ...e, dosageForm: form });
  next.sig = parseFor(e.sigRaw, form, e.genericName, e.brandName);
  next.confirmed = { ...e.confirmed, instructions: false, slots: false };
  return next;
}

/** The reviewer corrected the written directions: re-parse, and ask for confirmation again. */
export function editSigRaw(e: MedicineEntry, sigRaw: string): MedicineEntry {
  const next = touched({ ...e, sigRaw });
  next.confidence = { ...e.confidence, sig_raw: sigRaw.trim() ? 1 : 0 };
  next.sig = parseFor(sigRaw, e.dosageForm, e.genericName, e.brandName);
  next.tagalogOverride = null;
  next.confirmed = { ...e.confirmed, instructions: false, slots: false };
  return next;
}

export function editSlots(e: MedicineEntry, slots: SlotId[]): MedicineEntry {
  const ordered = SLOT_IDS.filter((s) => slots.includes(s));
  const sig: ParsedSig = { ...e.sig, slots: ordered, slotsBasis: ordered.length ? "written" : "none" };
  // keep "how many times a day" in step with the slots the reviewer chose
  const n = ordered.length;
  const f = sig.frequency;
  if (n > 0 && (!f || f.code === "OD" || f.code === "BID" || f.code === "TID" || f.code === "QID" || f.code === "TIMES")) {
    sig.frequency = { code: n === 1 ? "OD" : n === 2 ? "BID" : n === 3 ? "TID" : n === 4 ? "QID" : "TIMES", perDay: n };
  }
  const next = touched({ ...e, sig: recompose(sig) });
  next.confirmed = { ...e.confirmed, slots: true };
  return next;
}

export function editTiming(e: MedicineEntry, timing: Timing | null): MedicineEntry {
  return touched({ ...e, sig: recompose({ ...e.sig, timing }) });
}

export function editDuration(e: MedicineEntry, duration: Duration | null): MedicineEntry {
  return touched({ ...e, sig: recompose({ ...e.sig, duration }) });
}

/** Reviewer replaced the generated sentence with their own Tagalog. Empty text restores the generated one. */
export function editTagalogOverride(e: MedicineEntry, text: string): MedicineEntry {
  const t = text.trim();
  const next = touched({ ...e, tagalogOverride: t ? text : null });
  if (t) next.confirmed = { ...e.confirmed, instructions: true };
  return next;
}

export function editParaSaan(e: MedicineEntry, text: string): MedicineEntry {
  return touched({ ...e, paraSaan: text });
}

export function setPhoto(e: MedicineEntry, photo: MedicinePhoto | null): MedicineEntry {
  return touched({ ...e, photo });
}

// ---------------------------------------------------------------------------
// Confirming and the finalise gate
// ---------------------------------------------------------------------------

export function confirmField(e: MedicineEntry, key: AmberKey): MedicineEntry {
  return { ...e, confirmed: { ...e.confirmed, [key]: true } };
}

/** A line can only be confirmed once all of its amber fields are resolved. */
export function canConfirmLine(e: MedicineEntry): boolean {
  return pendingAmber(e).length === 0;
}

export function confirmLine(e: MedicineEntry): MedicineEntry {
  return canConfirmLine(e) ? { ...e, lineConfirmed: true } : e;
}

export function unconfirmLine(e: MedicineEntry): MedicineEntry {
  return { ...e, lineConfirmed: false };
}

export interface GateResult {
  ok: boolean;
  total: number;
  confirmedLines: number;
  pendingFields: number;
}

/** "Final" stays disabled until this is ok. */
export function canFinalize(entries: MedicineEntry[]): GateResult {
  const pendingFields = entries.reduce((n, e) => n + pendingAmber(e).length, 0);
  const confirmedLines = entries.filter((e) => e.lineConfirmed && pendingAmber(e).length === 0).length;
  return {
    ok: entries.length > 0 && pendingFields === 0 && confirmedLines === entries.length,
    total: entries.length,
    confirmedLines,
    pendingFields,
  };
}

// ---------------------------------------------------------------------------
// What the output pages show
// ---------------------------------------------------------------------------

export interface DisplayMedicine {
  id: string;
  /** null = the name could not be read: show "Hindi mabasa, itanong sa pharmacist o doktor". */
  name: string | null;
  brand: string;
  strength: string;
  form: DosageForm;
  tagalog: string;
  english: string;
  doseTl: string;
  doseEn: string;
  slots: SlotId[];
  timing: Timing["kind"] | null;
  prn: boolean;
  /** Only what the reviewer typed. */
  paraSaan: string;
  hasPhoto: boolean;
  amount: Amount | null;
  /** The person's own photo of the actual box (data URL), or null: then only a form icon is shown. */
  photoUrl: string | null;
  /** Warnings from comparing the photographed box with this line (red = real difference). */
  boxWarnings: BoxWarning[];
}

export function toDisplay(e: MedicineEntry): DisplayMedicine {
  const doseFor = (lang: Lang) => (e.sig.amount ? formatAmount(e.sig.amount, lang) : "");
  return {
    id: e.id,
    name: e.genericName.trim() || null,
    brand: e.brandName.trim(),
    strength: e.strength.trim(),
    form: e.dosageForm,
    tagalog: e.tagalogOverride?.trim() ? e.tagalogOverride.trim() : e.sig.tagalog,
    english: e.sig.english,
    doseTl: doseFor("tl"),
    doseEn: doseFor("en"),
    slots: e.sig.slots,
    timing: e.sig.timing?.kind ?? null,
    prn: e.sig.prn,
    paraSaan: e.paraSaan.trim(),
    hasPhoto: !!e.photo,
    amount: e.sig.amount,
    photoUrl: e.photo?.dataUrl ?? null,
    boxWarnings: e.photo?.box?.warnings ?? [],
  };
}
