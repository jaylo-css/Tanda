import { describe, expect, it } from "vitest";
import { entryFromExtracted, toDisplay } from "./review";
import { buildSchedule } from "./schedule";
import { SAMPLES } from "./samples";

const displays = (i: number) =>
  SAMPLES[i].extracted.medicines.map((m, k) => toDisplay(entryFromExtracted(m, `s${i}-${k}`)));

describe("daily schedule table", () => {
  it("has the five rows in order", () => {
    expect(buildSchedule([]).rows.map((r) => r.slot)).toEqual(["umaga", "tanghali", "hapon", "gabi", "bago_matulog"]);
  });

  it("places the typed sample's medicines into the right times of day", () => {
    const s = buildSchedule(displays(0));
    const names = (slot: string) => s.rows.find((r) => r.slot === slot)!.items.map((m) => m.name);
    expect(names("umaga")).toEqual(["Losartan", "Amlodipine", "Metformin"]);
    expect(names("gabi")).toEqual(["Metformin"]);
    expect(names("bago_matulog")).toEqual(["Atorvastatin"]);
    expect(names("tanghali")).toEqual([]);
    expect(names("hapon")).toEqual([]);
  });

  it("puts as-needed medicines in their own list, not in a time slot", () => {
    const s = buildSchedule(displays(0));
    expect(s.prn.map((m) => m.name)).toEqual(["Paracetamol"]);
    expect(s.rows.flatMap((r) => r.items).some((m) => m.name === "Paracetamol")).toBe(false);
  });

  it("a three-times-a-day medicine appears in three rows with its dose", () => {
    const s = buildSchedule(displays(1)); // amoxicillin 1 tsp TID
    const rowsWith = s.rows.filter((r) => r.items.some((m) => m.name === "Amoxicillin")).map((r) => r.slot);
    expect(rowsWith).toEqual(["umaga", "tanghali", "gabi"]);
    expect(s.rows[0].items[0].doseTl).toBe("1 kutsarita (5 mL)");
  });

  it("an unreadable line is not scheduled anywhere it was not confirmed", () => {
    const meds = displays(2);
    const s = buildSchedule(meds);
    const unreadable = meds.find((m) => m.name === null)!;
    expect(s.rows.flatMap((r) => r.items).map((m) => m.id)).not.toContain(unreadable.id);
    expect(s.other.map((m) => m.id)).toContain(unreadable.id);
  });
});
