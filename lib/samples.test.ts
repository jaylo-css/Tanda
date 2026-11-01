import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { SAMPLES } from "./samples";
import { extractedPrescriptionSchema, CONFIDENCE_THRESHOLD } from "./schema";
import { parseSig } from "./sig";

describe("synthetic sample prescriptions", () => {
  it("there are exactly three: typed, neat, messy", () => {
    expect(SAMPLES.map((s) => s.style)).toEqual(["typed", "neat", "messy"]);
  });

  it.each(SAMPLES)("$id passes the extraction schema", (sample) => {
    expect(extractedPrescriptionSchema.safeParse(sample.extracted).success).toBe(true);
  });

  it.each(SAMPLES)("$id is clearly fake (SAMPLE in patient name) and its image exists", (sample) => {
    expect(sample.extracted.patient.name).toMatch(/SAMPLE/);
    expect(existsSync(path.join(process.cwd(), "public", sample.image))).toBe(true);
  });

  it("covers the common senior medicines from the brief", () => {
    const names = new Set(SAMPLES.flatMap((s) => s.extracted.medicines.map((m) => m.generic_name.toLowerCase())));
    for (const drug of ["amlodipine", "losartan", "metformin", "atorvastatin", "paracetamol", "amoxicillin"]) {
      expect(names.has(drug)).toBe(true);
    }
  });

  it("every readable sig parses to Tagalog text", () => {
    for (const sample of SAMPLES) {
      for (const m of sample.extracted.medicines) {
        if (!m.sig_raw) continue;
        const p = parseSig(m.sig_raw, {
          dosageForm: m.dosage_form,
          ignoreWords: [m.generic_name, m.brand_name].filter(Boolean),
        });
        expect(p.tagalog.length).toBeGreaterThan(0);
        expect(p.unrecognized).toEqual([]);
      }
    }
  });

  it("the typed sample is mostly clean; the messy sample forces the human to look", () => {
    const needs = (id: string) =>
      SAMPLES.find((s) => s.id === id)!.extracted.medicines.filter(
        (m) =>
          Object.values(m.confidence).some((c) => c < CONFIDENCE_THRESHOLD) ||
          (m.sig_raw && parseSig(m.sig_raw, { dosageForm: m.dosage_form }).needsReview),
      ).length;
    expect(needs("sample-3-messy")).toBeGreaterThanOrEqual(4);
    expect(needs("sample-1-typed")).toBeLessThan(needs("sample-3-messy"));
  });

  it("the messy sample has a line nobody can read: no invented drug", () => {
    const unreadable = SAMPLES[2].extracted.medicines.find((m) => !m.generic_name && !m.sig_raw);
    expect(unreadable).toBeDefined();
    expect(unreadable!.strength).toBe("");
    expect(SAMPLES[2].extracted.unreadable_notes.length).toBeGreaterThan(0);
  });
});
