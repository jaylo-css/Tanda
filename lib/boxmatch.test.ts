import { describe, expect, it } from "vitest";
import {
  boxWarnings,
  compareStrength,
  nameSimilarity,
  parseStrength,
  strengthMismatchWarning,
  suggestMatch,
} from "./boxmatch";
import { editText, entryFromExtracted, setPhoto } from "./review";
import { SAMPLES } from "./samples";

describe("strength mismatch warning", () => {
  it("uses the exact wording from the brief (Tagalog and English)", () => {
    const w = strengthMismatchWarning("5 mg", "10 mg");
    expect(w.tl).toBe("Magkaiba ang lakas (5 mg vs 10 mg). Itanong sa pharmacist.");
    expect(w.en).toBe("The strengths are different (5 mg vs 10 mg). Ask the pharmacist.");
    expect(w.severity).toBe("danger"); // shown in red
  });

  it("5 mg on the prescription vs 10 mg on the box is a mismatch", () => {
    expect(compareStrength("5 mg", "10 mg")).toBe("mismatch");
    const w = boxWarnings({ generic_name: "Amlodipine", brand_name: "", strength: "10 mg" }, { genericName: "Amlodipine", brandName: "", strength: "5 mg" });
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe("strength");
    expect(w[0].tl).toBe("Magkaiba ang lakas (5 mg vs 10 mg). Itanong sa pharmacist.");
  });

  it("no warning when strengths agree, however they are written", () => {
    expect(compareStrength("5 mg", "5mg")).toBe("match");
    expect(compareStrength("5 MG", "5 mg")).toBe("match");
    expect(compareStrength("0.5 g", "500 mg")).toBe("match");
    expect(compareStrength("500 mcg", "0.5 mg")).toBe("match");
    expect(compareStrength("250 mg/5 mL", "250mg/5ml")).toBe("match");
    expect(compareStrength("500 mg/5 mL", "100 mg/mL")).toBe("match"); // same concentration
    const w = boxWarnings({ generic_name: "Losartan", brand_name: "", strength: "50mg" }, { genericName: "Losartan", brandName: "", strength: "50 mg" });
    expect(w).toEqual([]);
  });

  it("different concentrations, units or families are mismatches", () => {
    expect(compareStrength("250 mg/5 mL", "125 mg/5 mL")).toBe("mismatch");
    expect(compareStrength("500 mg", "500 mcg")).toBe("mismatch");
    expect(compareStrength("500 mg", "500 iu")).toBe("mismatch");
    expect(compareStrength("1 %", "2 %")).toBe("mismatch");
  });

  it("cannot-compare cases are 'unknown' (amber note), never a false all-clear or a false alarm", () => {
    expect(compareStrength("5 mg", "")).toBe("unknown");
    expect(compareStrength("", "5 mg")).toBe("unknown");
    expect(compareStrength("5 mg", "extra strength")).toBe("unknown");
    expect(compareStrength("250 mg/5 mL", "250 mg")).toBe("unknown");
    const w = boxWarnings({ generic_name: "Amlodipine", brand_name: "", strength: "" }, { genericName: "Amlodipine", brandName: "", strength: "5 mg" });
    expect(w[0].severity).toBe("caution");
  });

  it("parses strengths", () => {
    expect(parseStrength("0.5 g")).toEqual({ amount: 500, unit: "mg", perMl: null });
    expect(parseStrength("250 mg/5 mL")).toEqual({ amount: 250, unit: "mg", perMl: 5 });
    expect(parseStrength("no number")).toBeNull();
  });
});

describe("matching a box to a prescription line", () => {
  const entries = SAMPLES[2].extracted.medicines
    .filter((m) => m.generic_name)
    .map((m, i) => entryFromExtracted(m, `e${i}`));

  it("suggests the right line from the printed name", () => {
    const hit = suggestMatch({ generic_name: "Amlodipine", brand_name: "Norvasc", strength: "10 mg" }, entries);
    expect(entries.find((e) => e.id === hit?.id)?.genericName).toBe("Amlodipine");
  });

  it("matches by brand name and tolerates small misreads", () => {
    const withBrand = [{ id: "a", genericName: "Paracetamol", brandName: "Biogesic", strength: "500 mg" }];
    expect(suggestMatch({ generic_name: "", brand_name: "Biogesic", strength: "500 mg" }, withBrand)?.id).toBe("a");
    expect(suggestMatch({ generic_name: "Paracetamoi", brand_name: "", strength: "500 mg" }, withBrand)?.id).toBe("a");
  });

  it("returns null when nothing is close (the person attaches it by hand)", () => {
    expect(suggestMatch({ generic_name: "Warfarin", brand_name: "", strength: "5 mg" }, entries)).toBeNull();
    expect(suggestMatch({ generic_name: "", brand_name: "", strength: "5 mg" }, entries)).toBeNull();
  });

  it("when the same drug appears twice, prefers the line with the same strength", () => {
    const two = [
      { id: "five", genericName: "Amlodipine", brandName: "", strength: "5 mg" },
      { id: "ten", genericName: "Amlodipine", brandName: "", strength: "10 mg" },
    ];
    expect(suggestMatch({ generic_name: "Amlodipine", brand_name: "", strength: "10 mg" }, two)?.id).toBe("ten");
    expect(suggestMatch({ generic_name: "Amlodipine", brand_name: "", strength: "5 mg" }, two)?.id).toBe("five");
  });

  it("a confirmed box with a different DRUG name still gets a red warning", () => {
    const w = boxWarnings({ generic_name: "Losartan", brand_name: "", strength: "50 mg" }, { genericName: "Amlodipine", brandName: "", strength: "50 mg" });
    expect(w.some((x) => x.kind === "name" && x.severity === "danger")).toBe(true);
  });

  it("similarity ignores form words and punctuation", () => {
    expect(nameSimilarity("Amlodipine 5 mg tablet", "amlodipine")).toBe(1);
    expect(nameSimilarity("", "amlodipine")).toBe(0);
  });
});

describe("warnings follow the corrected strength", () => {
  it("fixing the prescription strength clears or creates the warning", () => {
    const base = entryFromExtracted(SAMPLES[0].extracted.medicines[1], "x"); // Amlodipine 5 mg
    const withBox = setPhoto(base, {
      dataUrl: "data:image/jpeg;base64,AAAA",
      box: { label: { generic_name: "Amlodipine", brand_name: "", strength: "10 mg" }, confirmedByUser: true, warnings: boxWarnings({ generic_name: "Amlodipine", brand_name: "", strength: "10 mg" }, base) },
    });
    expect(withBox.photo?.box?.warnings.some((w) => w.kind === "strength")).toBe(true);
    const corrected = editText(withBox, "strength", "10 mg");
    expect(corrected.photo?.box?.warnings).toEqual([]);
    const broken = editText(corrected, "strength", "20 mg");
    expect(broken.photo?.box?.warnings[0].tl).toBe("Magkaiba ang lakas (20 mg vs 10 mg). Itanong sa pharmacist.");
  });
});
