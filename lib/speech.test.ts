import { describe, expect, it } from "vitest";
import { buildSpeechItems, pickVoice, speechForMedicine, spoken } from "./speech";
import { buildPrescriptionData } from "./prescription";
import { confirmField, confirmLine, entryFromExtracted, pendingAmber, type MedicineEntry } from "./review";
import { SAMPLES } from "./samples";

const v = (lang: string, name = lang) => ({ lang, name });

describe("voice choice", () => {
  it("prefers a Filipino voice (fil-PH) for Tagalog", () => {
    const r = pickVoice([v("en-US"), v("fil-PH", "Blessica"), v("en-GB")], "tl");
    expect(r.voice?.name).toBe("Blessica");
    expect(r.filipino).toBe(true);
  });
  it("accepts fil, tl-PH and underscore spellings", () => {
    expect(pickVoice([v("fil")], "tl").filipino).toBe(true);
    expect(pickVoice([v("tl-PH")], "tl").filipino).toBe(true);
    expect(pickVoice([v("fil_PH")], "tl").filipino).toBe(true);
  });
  it("falls back to English and says it is NOT Filipino (so the UI can show the note)", () => {
    const r = pickVoice([v("en-GB"), v("en-US"), v("de-DE")], "tl");
    expect(r.filipino).toBe(false);
    expect(r.voice?.lang).toBe("en-US");
  });
  it("English mode picks an English voice; no voices at all gives null", () => {
    expect(pickVoice([v("fil-PH"), v("en-PH")], "en").voice?.lang).toBe("en-PH");
    expect(pickVoice([], "tl")).toEqual({ voice: null, filipino: false });
  });
});

describe("what is read aloud", () => {
  const entries = (i: number): MedicineEntry[] =>
    SAMPLES[i].extracted.medicines.map((m, k) => {
      let e = entryFromExtracted(m, `s${i}${k}`);
      for (const key of pendingAmber(e)) e = confirmField(e, key);
      return confirmLine(e);
    });
  const data = (i: number) =>
    buildPrescriptionData({ header: { doctor: { name: "Dr. Sample", clinic: "", license_no: "" }, patient: { name: "Juan SAMPLE", age: "68" }, date: "2026-10-15" }, reviewer: { name: "Ana", role: "kapamilya" }, entries: entries(i), finalizedAt: "2026-11-02T01:00:00.000Z" });

  it("reads each medicine one by one: intro, one item per medicine, then the disclaimer", () => {
    const items = buildSpeechItems(data(0), "tl");
    expect(items).toHaveLength(5 + 2);
    expect(items[0].id).toBeNull();
    expect(items.slice(1, -1).map((x) => x.id)).toEqual(data(0).medicines.map((m) => m.id));
    expect(items.at(-1)!.text).toBe("Ito ay gabay lamang. Ang orihinal na reseta ang opisyal.");
  });

  it("speaks units in words and never says symbols", () => {
    expect(spoken("500 mg", "tl")).toBe("500 miligramo");
    expect(spoken("250 mg/5 mL", "tl")).toBe("250 miligramo sa 5 mililitro");
    expect(spoken("1 kutsarita (5 mL)", "tl")).toBe("1 kutsarita, 5 mililitro");
    expect(spoken("2 beses isang araw (umaga at gabi), pagkatapos kumain", "tl")).toBe("2 beses isang araw, umaga at gabi, pagkatapos kumain");
    expect(spoken("250 mg/5 mL", "en")).toBe("250 milligrams per 5 milliliters");
  });

  it("a medicine item has number, name, strength and the Tagalog directions", () => {
    const d = data(0);
    const text = speechForMedicine(d.medicines[2], 3, "tl");
    expect(text).toBe("Gamot 3. Metformin, 500 miligramo. 1 tableta, 2 beses isang araw, umaga at gabi, pagkatapos kumain, araw-araw, tuloy-tuloy.");
  });

  it("an unreadable line is read as 'ask your pharmacist', never as a guess", () => {
    const d = data(2);
    const unreadable = d.medicines.find((m) => m.name === null)!;
    expect(speechForMedicine(unreadable, 5, "tl")).toBe("Gamot 5. Hindi mabasa, itanong sa pharmacist o doktor.");
  });

  it("reads box warnings aloud too", () => {
    const d = data(0);
    const m = { ...d.medicines[1], boxWarnings: [{ kind: "strength" as const, severity: "danger" as const, tl: "Magkaiba ang lakas (5 mg vs 10 mg). Itanong sa pharmacist.", en: "x" }] };
    expect(speechForMedicine(m, 2, "tl")).toContain("Babala: Magkaiba ang lakas, 5 miligramo vs 10 miligramo. Itanong sa pharmacist.");
  });

  it("English version exists too", () => {
    const items = buildSpeechItems(data(0), "en");
    expect(items[0].text).toBe("Your medicines. For Juan SAMPLE. There are 5 medicines.");
    expect(items.at(-1)!.text).toBe("This is a guide only. The original prescription is the official one.");
  });
});
