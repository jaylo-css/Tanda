/**
 * Read-aloud using the browser's built-in Web Speech API (speechSynthesis): free, no server, no paid TTS.
 * Pure helpers live here (voice choice + the text that is spoken); the browser glue is in useSpeech.ts.
 *
 * What is read is ONLY the confirmed clear version: the same text, warnings and disclaimer the
 * page shows. Nothing is added.
 */
import type { PrescriptionData } from "./prescription";
import { DISCLAIMER } from "./i18n";
import type { DisplayMedicine } from "./review";
import { UNREADABLE_EN, UNREADABLE_TL, type Lang } from "./sig";

export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
}

export interface VoicePick<V> {
  voice: V | null;
  /** True only when a Filipino voice (fil-PH / tl) was found. */
  filipino: boolean;
}

const norm = (v: VoiceLike) => v.lang.toLowerCase().replace("_", "-");

function pickEnglish<V extends VoiceLike>(voices: V[]): V | null {
  for (const p of ["en-ph", "en-us", "en-gb"]) {
    const v = voices.find((x) => norm(x) === p);
    if (v) return v;
  }
  return voices.find((x) => norm(x).startsWith("en")) ?? null;
}

/** Filipino voice (fil-PH) when the device has one; otherwise an English voice (the UI then says so). */
export function pickVoice<V extends VoiceLike>(voices: V[], want: Lang): VoicePick<V> {
  if (want === "tl") {
    for (const p of ["fil-ph", "fil", "tl-ph", "tl"]) {
      const v = voices.find((x) => norm(x) === p || norm(x).startsWith(p + "-"));
      if (v) return { voice: v, filipino: true };
    }
  }
  return { voice: pickEnglish(voices), filipino: false };
}

/** Makes written units speakable ("500 mg" -> "500 miligramo") and removes symbols voices stumble on. */
export function spoken(text: string, lang: Lang): string {
  const tl = lang === "tl";
  return text
    .replace(/\bmcg\b/gi, tl ? "mikrogramo" : "micrograms")
    .replace(/\bmg\b/gi, tl ? "miligramo" : "milligrams")
    .replace(/\bmL\b/g, tl ? "mililitro" : "milliliters")
    .replace(/\bIU\b/g, tl ? "international units" : "international units")
    .replace(/(\d)\s*g\b/g, tl ? "$1 gramo" : "$1 grams")
    .replace(/%/g, tl ? " porsyento" : " percent")
    .replace(/\s*\/\s*/g, tl ? " sa " : " per ")
    .replace(/[()]/g, ",")
    .replace(/[⚠✓🔊]/g, "")
    // tidy the commas the brackets left behind: "araw ,umaga" -> "araw, umaga", "mg,." -> "mg."
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/,(?=[^\s,.!?])/g, ", ")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/,\s*$/, "")
    .trim();
}

export interface SpeechItem {
  /** Medicine id (so the page can highlight it), or null for the intro / disclaimer. */
  id: string | null;
  text: string;
}

export function speechForMedicine(m: DisplayMedicine, n: number, lang: Lang): string {
  const tl = lang === "tl";
  const label = tl ? `Gamot ${n}.` : `Medicine ${n}.`;
  if (m.name === null) return `${label} ${tl ? UNREADABLE_TL : UNREADABLE_EN}.`;
  const head = [m.name, m.strength && spoken(m.strength, lang)].filter(Boolean).join(", ");
  const sentence = spoken(tl ? m.tagalog : m.english, lang);
  const parts = [label, `${head}.`, `${sentence}.`];
  if (m.paraSaan) parts.push(tl ? `Para saan: ${m.paraSaan}.` : `For: ${m.paraSaan}.`);
  for (const w of m.boxWarnings) parts.push(`${tl ? "Babala:" : "Warning:"} ${spoken(tl ? w.tl : w.en, lang)}`);
  return parts.join(" ");
}

/** Intro, one item per medicine (read one by one), then the mandatory disclaimer. */
export function buildSpeechItems(data: PrescriptionData, lang: Lang): SpeechItem[] {
  const tl = lang === "tl";
  const n = data.medicines.length;
  const who = data.patientName ? (tl ? ` Para kay ${data.patientName}.` : ` For ${data.patientName}.`) : "";
  const items: SpeechItem[] = [
    { id: null, text: tl ? `Ang iyong gamot.${who} May ${n} na gamot.` : `Your medicines.${who} There ${n === 1 ? "is" : "are"} ${n} medicine${n === 1 ? "" : "s"}.` },
    ...data.medicines.map((m, i) => ({ id: m.id, text: speechForMedicine(m, i + 1, lang) })),
    { id: null, text: DISCLAIMER[lang] },
  ];
  return items;
}
