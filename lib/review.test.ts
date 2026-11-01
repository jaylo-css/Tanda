import { describe, expect, it } from "vitest";
import {
  blankEntry,
  canConfirmLine,
  canFinalize,
  computeAmberKeys,
  confirmField,
  confirmLine,
  editParaSaan,
  editSigRaw,
  editSlots,
  editText,
  entryFromExtracted,
  pendingAmber,
  toDisplay,
  type MedicineEntry,
} from "./review";
import { SAMPLES } from "./samples";
import type { ExtractedMedicine } from "./schema";
import { UNREADABLE_TL } from "./sig";

const med = (over: Partial<ExtractedMedicine> = {}): ExtractedMedicine => ({
  raw_text: "Losartan 50 mg tab",
  generic_name: "Losartan",
  brand_name: "",
  strength: "50 mg",
  dosage_form: "tablet",
  quantity: "30",
  sig_raw: "1 tab BID pc x 7 days",
  confidence: { generic_name: 0.95, strength: 0.95, sig_raw: 0.95 },
  ...over,
});

/** Confirm every amber field, then the line: what a careful reviewer does. */
function reviewFully(e: MedicineEntry): MedicineEntry {
  let x = e;
  for (const k of pendingAmber(x)) x = confirmField(x, k);
  return confirmLine(x);
}

describe("review gate: amber fields", () => {
  it("a clear, confident line has no amber fields", () => {
    const e = entryFromExtracted(med(), "a");
    expect(computeAmberKeys(e)).toEqual([]);
  });

  it("confidence below 0.8 is amber (name, strength, directions)", () => {
    const e = entryFromExtracted(
      med({ confidence: { generic_name: 0.79, strength: 0.5, sig_raw: 0.6 } }),
      "a",
    );
    expect(computeAmberKeys(e)).toEqual(["name", "strength", "instructions"]);
  });

  it("exactly 0.8 is not amber", () => {
    const e = entryFromExtracted(med({ confidence: { generic_name: 0.8, strength: 0.8, sig_raw: 0.8 } }), "a");
    expect(computeAmberKeys(e)).toEqual([]);
  });

  it("empty fields are always amber, whatever the confidence says", () => {
    const e = entryFromExtracted(med({ strength: "", confidence: { generic_name: 1, strength: 1, sig_raw: 1 } }), "a");
    expect(computeAmberKeys(e)).toContain("strength");
  });

  it("parser flags make instructions amber; an assumed time slot is its own amber field", () => {
    const e = entryFromExtracted(med({ sig_raw: "1 tab OD" }), "a");
    expect(computeAmberKeys(e)).toEqual(["slots"]);
    const e2 = entryFromExtracted(med({ sig_raw: "1 tab BID then 2 tab OD" }), "b");
    expect(computeAmberKeys(e2)).toContain("instructions");
  });
});

describe("review gate: cannot finalise with unconfirmed fields", () => {
  it("blocks when an amber field is unconfirmed", () => {
    const e = entryFromExtracted(med({ confidence: { generic_name: 0.5, strength: 0.95, sig_raw: 0.95 } }), "a");
    const g = canFinalize([e]);
    expect(g.ok).toBe(false);
    expect(g.pendingFields).toBe(1);
  });

  it("a line with an unconfirmed amber field cannot even be marked confirmed", () => {
    const e = entryFromExtracted(med({ strength: "5?? mg", confidence: { generic_name: 0.95, strength: 0.3, sig_raw: 0.95 } }), "a");
    expect(canConfirmLine(e)).toBe(false);
    expect(confirmLine(e).lineConfirmed).toBe(false);
  });

  it("blocks when fields are fine but the human has not confirmed the line", () => {
    const e = entryFromExtracted(med(), "a");
    expect(canFinalize([e]).ok).toBe(false);
    expect(canFinalize([confirmLine(e)]).ok).toBe(true);
  });

  it("allows finalising once every amber field and every line is confirmed", () => {
    const e = entryFromExtracted(med({ confidence: { generic_name: 0.5, strength: 0.5, sig_raw: 0.5 } }), "a");
    expect(canFinalize([e]).ok).toBe(false);
    expect(canFinalize([reviewFully(e)]).ok).toBe(true);
  });

  it("blocks if ANY one of several lines is unresolved", () => {
    const good = reviewFully(entryFromExtracted(med(), "a"));
    const bad = entryFromExtracted(med({ confidence: { generic_name: 0.2, strength: 0.95, sig_raw: 0.95 } }), "b");
    expect(canFinalize([good, bad]).ok).toBe(false);
    expect(canFinalize([good, reviewFully(bad)]).ok).toBe(true);
  });

  it("an empty list cannot be finalised", () => {
    expect(canFinalize([]).ok).toBe(false);
  });

  it("editing a confirmed line un-confirms it", () => {
    const e = reviewFully(entryFromExtracted(med(), "a"));
    expect(e.lineConfirmed).toBe(true);
    const edited = editText(e, "brandName", "Cozaar");
    expect(edited.lineConfirmed).toBe(false);
    expect(canFinalize([edited]).ok).toBe(false);
  });

  it("editing an amber field to a real value resolves it; clearing it makes it amber again", () => {
    const e = entryFromExtracted(med({ confidence: { generic_name: 0.95, strength: 0.4, sig_raw: 0.95 } }), "a");
    const fixed = editText(e, "strength", "100 mg");
    expect(pendingAmber(fixed)).toEqual([]);
    const cleared = editText(fixed, "strength", "");
    expect(pendingAmber(cleared)).toEqual(["strength"]);
  });

  it("correcting the written directions re-parses and asks for confirmation again", () => {
    let e = reviewFully(entryFromExtracted(med({ sig_raw: "1 tab OD in the morning" }), "a"));
    expect(canFinalize([e]).ok).toBe(true);
    e = editSigRaw(e, "1 tab OD");
    expect(e.sig.slotsBasis).toBe("assumed");
    expect(pendingAmber(e)).toEqual(["slots"]);
    e = editSlots(e, ["gabi"]);
    expect(pendingAmber(e)).toEqual([]);
    expect(e.sig.tagalog).toBe("1 tableta, isang beses isang araw (gabi)");
  });

  it("choosing time slots keeps the number of daily doses in step", () => {
    const e = editSlots(entryFromExtracted(med({ sig_raw: "1 tab OD" }), "a"), ["umaga", "tanghali", "gabi"]);
    expect(e.sig.frequency).toEqual({ code: "TID", perDay: 3 });
    expect(e.sig.tagalog).toBe("1 tableta, 3 beses isang araw (umaga, tanghali at gabi)");
  });
});

describe("review gate: unreadable lines and hand entry", () => {
  const unreadable = () =>
    entryFromExtracted(
      med({ raw_text: "(hindi mabasa)", generic_name: "", strength: "", sig_raw: "", confidence: { generic_name: 0.1, strength: 0.1, sig_raw: 0.1 } }),
      "u",
    );

  it("an unreadable line is all amber and shows the 'ask your pharmacist' message, not a guess", () => {
    const e = unreadable();
    expect(computeAmberKeys(e)).toEqual(["name", "strength", "instructions"]);
    const d = toDisplay(e);
    expect(d.name).toBeNull();
    expect(d.tagalog).toBe(UNREADABLE_TL);
  });

  it("a hand-typed line starts fully amber and nothing is pre-filled", () => {
    const e = blankEntry("m");
    expect(e.manual).toBe(true);
    expect(computeAmberKeys(e)).toEqual(["name", "strength", "instructions"]);
    expect(canFinalize([e]).ok).toBe(false);
  });

  it("typing a hand-entered line resolves it", () => {
    let e = blankEntry("m");
    e = editText(e, "genericName", "Metformin");
    e = editText(e, "strength", "500 mg");
    e = editSigRaw(e, "1 tab BID pc");
    expect(pendingAmber(e)).toEqual([]);
    expect(canFinalize([confirmLine(e)]).ok).toBe(true);
  });
});

describe("review: no invented medical advice", () => {
  it("'para saan' is empty unless the reviewer types it, even when the doctor wrote 'for fever'", () => {
    const e = entryFromExtracted(med({ sig_raw: "1 tab q6h PRN for fever" }), "a");
    expect(e.paraSaan).toBe("");
    expect(e.sig.indicationRaw).toBe("fever"); // shown to the reviewer as a hint only
    expect(toDisplay(e).paraSaan).toBe("");
    expect(toDisplay(e).tagalog).not.toMatch(/lagnat|para saan/i);
    expect(toDisplay(editParaSaan(e, "para sa lagnat")).paraSaan).toBe("para sa lagnat");
  });
});

describe("review gate with the three synthetic samples", () => {
  it.each(SAMPLES)("$id: cannot finalise until reviewed, then can", (sample) => {
    const entries = sample.extracted.medicines.map((m, i) => entryFromExtracted(m, `${sample.id}-${i}`));
    expect(canFinalize(entries).ok).toBe(false);
    expect(canFinalize(entries.map(reviewFully)).ok).toBe(true);
  });

  it("the messy sample has several amber fields to resolve; the typed one far fewer", () => {
    const pending = (id: string) =>
      SAMPLES.find((s) => s.id === id)!.extracted.medicines
        .map((m, i) => entryFromExtracted(m, String(i)))
        .reduce((n, e) => n + pendingAmber(e).length, 0);
    expect(pending("sample-3-messy")).toBeGreaterThan(pending("sample-1-typed"));
    expect(pending("sample-3-messy")).toBeGreaterThanOrEqual(6);
  });
});
