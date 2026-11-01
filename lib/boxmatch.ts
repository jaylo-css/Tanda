/**
 * Matching a photographed medicine box to a prescription line, and comparing strengths.
 *
 * The AI only READS the printed label (a suggestion). Everything here is plain code, and the
 * person always confirms the match. A strength mismatch is a RED warning, never silently ignored.
 */
import type { BoxCheck, BoxWarning, MedicineEntry } from "./review";

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------

export type StrengthStatus = "match" | "mismatch" | "unknown";

export interface ParsedStrength {
  /** Mass units are normalised to mg. IU / mEq / % keep their own number. */
  amount: number;
  unit: "mg" | "iu" | "meq" | "%";
  /** Volume in mL for liquids ("250 mg/5 mL" -> 5). null when no volume is written. */
  perMl: number | null;
}

export function parseStrength(input: string): ParsedStrength | null {
  const t = input.toLowerCase().replace(/,/g, "").replace(/µ/g, "u");
  const m = /(\d+(?:\.\d+)?)\s*(mg|mcg|ug|g|iu|meq|%)(?:\s*\/\s*(\d*(?:\.\d+)?)\s*(ml|l)\b)?/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  let amount = n;
  let unit: ParsedStrength["unit"];
  if (u === "mg") unit = "mg";
  else if (u === "g") {
    amount = n * 1000;
    unit = "mg";
  } else if (u === "mcg" || u === "ug") {
    amount = n / 1000;
    unit = "mg";
  } else unit = u as "iu" | "meq" | "%";
  let perMl: number | null = null;
  if (m[4]) {
    const v = m[3] === "" || m[3] === undefined ? 1 : Number(m[3]);
    perMl = m[4] === "l" ? v * 1000 : v;
  }
  return { amount, unit, perMl };
}

export function compareStrength(rx: string, box: string): StrengthStatus {
  if (!rx.trim() || !box.trim()) return "unknown";
  const a = parseStrength(rx);
  const b = parseStrength(box);
  if (!a || !b) return "unknown";
  if (a.unit !== b.unit) return "mismatch";
  // a liquid on one side and a tablet on the other cannot be compared by number
  if ((a.perMl === null) !== (b.perMl === null)) return "unknown";
  const x = a.perMl ? a.amount / a.perMl : a.amount;
  const y = b.perMl ? b.amount / b.perMl : b.amount;
  return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y)) ? "match" : "mismatch";
}

/** The exact wording from the brief: "Magkaiba ang lakas (5 mg vs 10 mg). Itanong sa pharmacist." */
export function strengthMismatchWarning(rx: string, box: string): BoxWarning {
  return {
    kind: "strength",
    severity: "danger",
    tl: `Magkaiba ang lakas (${rx.trim()} vs ${box.trim()}). Itanong sa pharmacist.`,
    en: `The strengths are different (${rx.trim()} vs ${box.trim()}). Ask the pharmacist.`,
  };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const NOISE = /\b(tablets?|tabs?|capsules?|caps?|syrup|suspension|susp|drops?|cream|ointment|inhaler|injection|film[- ]coated|usp|bp|mg|mcg|ml|g|iu)\b/g;

export function normalizeDrugName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(NOISE, " ")
    .replace(/[^a-z]/g, "");
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** 0..1. Empty names never match anything. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeDrugName(a);
  const y = normalizeDrugName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))) return 0.95;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export const MATCH_THRESHOLD = 0.8;
/** Below this, a name the person confirmed still gets a red "different name" warning. */
export const NAME_WARN_BELOW = 0.6;

interface LabelNames {
  generic_name: string;
  brand_name: string;
}

function bestNameScore(label: LabelNames, e: Pick<MedicineEntry, "genericName" | "brandName">): number {
  const pairs: Array<[string, string]> = [
    [label.generic_name, e.genericName],
    [label.generic_name, e.brandName],
    [label.brand_name, e.brandName],
    [label.brand_name, e.genericName],
  ];
  return Math.max(0, ...pairs.map(([a, b]) => nameSimilarity(a, b)));
}

export interface MatchSuggestion {
  id: string;
  score: number;
}

/**
 * Suggests which prescription line a box belongs to. Returns null when nothing is close enough
 * (the person can still attach the photo by hand). If two lines are the same drug in different
 * strengths, the one whose strength equals the box's strength is preferred.
 */
export function suggestMatch(
  label: LabelNames & { strength: string },
  entries: Array<Pick<MedicineEntry, "id" | "genericName" | "brandName" | "strength">>,
): MatchSuggestion | null {
  const scored = entries
    .map((e) => ({ id: e.id, score: bestNameScore(label, e), strengthOk: compareStrength(e.strength, label.strength) === "match" }))
    .filter((c) => c.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || Number(b.strengthOk) - Number(a.strengthOk));
  if (scored.length === 0) return null;
  const top = scored[0];
  const tied = scored.filter((c) => Math.abs(c.score - top.score) < 0.05);
  const pick = tied.find((c) => c.strengthOk) ?? top;
  return { id: pick.id, score: pick.score };
}

// ---------------------------------------------------------------------------
// The check stored with a photo
// ---------------------------------------------------------------------------

export function boxWarnings(
  label: LabelNames & { strength: string },
  entry: Pick<MedicineEntry, "genericName" | "brandName" | "strength">,
): BoxWarning[] {
  const out: BoxWarning[] = [];
  const score = bestNameScore(label, entry);
  const boxName = label.generic_name.trim() || label.brand_name.trim();
  const rxName = entry.genericName.trim() || entry.brandName.trim();
  if (boxName && rxName && score < NAME_WARN_BELOW) {
    out.push({
      kind: "name",
      severity: "danger",
      tl: `Magkaiba ang pangalan sa kahon (${boxName}) at sa reseta (${rxName}). Itanong sa pharmacist.`,
      en: `The name on the box (${boxName}) and on the prescription (${rxName}) are different. Ask the pharmacist.`,
    });
  }
  const status = compareStrength(entry.strength, label.strength);
  if (status === "mismatch") out.push(strengthMismatchWarning(entry.strength, label.strength));
  else if (status === "unknown") {
    out.push({
      kind: "strength_unknown",
      severity: "caution",
      tl: "Hindi nabasa o hindi maihambing ang lakas sa kahon. Tingnan mo mismo ang lakas na nakasulat sa kahon.",
      en: "The strength on the box could not be read or compared. Please check the strength printed on the box yourself.",
    });
  }
  return out;
}

export function buildBoxCheck(
  label: LabelNames & { strength: string },
  entry: Pick<MedicineEntry, "genericName" | "brandName" | "strength">,
  confirmedByUser: boolean,
): BoxCheck {
  return {
    label: { generic_name: label.generic_name, brand_name: label.brand_name, strength: label.strength },
    confirmedByUser,
    warnings: boxWarnings(label, entry),
  };
}
