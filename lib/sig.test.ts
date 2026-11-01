import { describe, expect, it } from "vitest";
import { composeSig, formatAmount, parseSig, UNREADABLE_TL } from "./sig";

/**
 * Expected sentences below were written by hand from how a pharmacist would
 * say each line in Tagalog - they are NOT copied from the parser's output.
 */

describe("sig parser: full sentences (Tagalog)", () => {
  const cases: Array<[string, string]> = [
    // 1 - the example from the product spec
    ["1 tab BID pc x 7 days", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain, sa loob ng 7 araw"],
    // 2 - dots and capitals
    ["1 tab B.I.D. P.C. x 7 days", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain, sa loob ng 7 araw"],
    // 3 - once a day, time of day not written -> slot is only a suggestion (flag tested below)
    ["1 tab OD", "1 tableta, isang beses isang araw (umaga)"],
    // 4
    ["1 tab QD", "1 tableta, isang beses isang araw (umaga)"],
    // 5 - TID before meals
    ["1 cap TID ac", "1 kapsula, 3 beses isang araw (umaga, tanghali at gabi), bago kumain"],
    // 6 - QID with meals timing places the 4th dose at bedtime
    ["1 tab QID pc", "1 tableta, 4 beses isang araw (umaga, tanghali, gabi at bago matulog), pagkatapos kumain"],
    // 7 - every 8 hours
    ["1 cap q8h x 7 days", "1 kapsula, tuwing 8 oras, sa loob ng 7 araw"],
    // 8 - every 6 hours as needed (paracetamol style)
    ["500 mg 1 tab q6h PRN", "1 tableta, tuwing 6 oras kung kailangan"],
    // 9 - every 12 hours
    ["1 tab q12h", "1 tableta, tuwing 12 oras"],
    // 10 - every 4 hours
    ["2 tabs q4h", "2 tableta, tuwing 4 oras"],
    // 11 - bedtime
    ["1 tab HS", "1 tableta, bago matulog"],
    // 12
    ["1 tab at bedtime", "1 tableta, bago matulog"],
    // 13 - as needed with no interval is understood but flagged (see flag tests)
    ["1 tab PRN", "1 tableta, kung kailangan"],
    // 14
    ["2 tabs STAT", "2 tableta, ngayon din"],
    // 15 - with meals
    ["1 tab BID with meals", "1 tableta, 2 beses isang araw (umaga at gabi), kasabay ng pagkain"],
    // 16 - maintenance
    ["1 tab OD maintenance", "1 tableta, isang beses isang araw (umaga), araw-araw, tuloy-tuloy"],
    // 17 - teaspoon shows mL
    ["1 tsp TID x 7 days", "1 kutsarita (5 mL), 3 beses isang araw (umaga, tanghali at gabi), sa loob ng 7 araw"],
    // 18 - tablespoon shows mL
    ["1 tbsp BID", "1 kutsara (15 mL), 2 beses isang araw (umaga at gabi)"],
    // 19 - mL
    ["5 mL BID x 5 days", "5 mL, 2 beses isang araw (umaga at gabi), sa loob ng 5 araw"],
    // 20 - drops, eye
    ["2 drops OU TID", "Ipatak sa magkabilang mata: 2 patak, 3 beses isang araw (umaga, tanghali at gabi)"],
    // 21 - puffs
    ["2 puffs q6h PRN", "2 buga, tuwing 6 oras kung kailangan"],
    // 22 - route by mouth, uppercase PO
    ["1 tab PO BID", "Iinumin: 1 tableta, 2 beses isang araw (umaga at gabi)"],
    // 23 - sublingual
    ["1 tab SL PRN", "Ilagay sa ilalim ng dila: 1 tableta, kung kailangan"],
    // 24 - topical, no amount needed
    ["apply topical BID x 14 days", "Ipahid sa balat: 2 beses isang araw (umaga at gabi), sa loob ng 14 araw"],
    // 25 - half a tablet
    ["1/2 tab OD", "kalahating tableta, isang beses isang araw (umaga)"],
    // 26 - one and a half
    ["1 1/2 tab BID", "1 at kalahating tableta, 2 beses isang araw (umaga at gabi)"],
    // 27 - unicode half
    ["1½ tab TID", "1 at kalahating tableta, 3 beses isang araw (umaga, tanghali at gabi)"],
    // 28 - weeks
    ["1 tab BID x 2 weeks", "1 tableta, 2 beses isang araw (umaga at gabi), sa loob ng 2 linggo"],
    // 29 - months
    ["1 tab OD x 1 month", "1 tableta, isang beses isang araw (umaga), sa loob ng 1 buwan"],
    // 30 - plain English frequency words
    ["1 tab twice a day after meals", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain"],
    // 31 - "2x/day"
    ["1 tab 2x/day pc x 10 days", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain, sa loob ng 10 araw"],
    // 32 - three times a day
    ["1 tab three times a day", "1 tableta, 3 beses isang araw (umaga, tanghali at gabi)"],
    // 33 - in the morning (time written -> no guess)
    ["1 tab in the morning", "1 tableta, isang beses isang araw (umaga)"],
    // 34 - morning and evening
    ["1 tab morning and evening pc", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain"],
    // 35 - at night
    ["1 tab at night", "1 tableta, isang beses isang araw (gabi)"],
    // 36 - empty stomach
    ["1 tab OD empty stomach", "1 tableta, isang beses isang araw (umaga), sa walang laman na tiyan"],
    // 37 - lead time before meals
    ["1 tab TID 30 min ac", "1 tableta, 3 beses isang araw (umaga, tanghali at gabi), 30 minuto bago kumain"],
    // 38 - until finished
    ["1 cap TID until finished", "1 kapsula, 3 beses isang araw (umaga, tanghali at gabi), hanggang maubos"],
    // 39 - Tagalog words in
    ["1 tableta dalawang beses isang araw pagkatapos kumain", "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain"],
    // 40 - range of hours
    ["1-2 tabs q4-6h PRN", "1 hanggang 2 tableta, tuwing 4 hanggang 6 oras kung kailangan"],
    // 41 - politeness "po" is ignored, strength inside the sig is ignored
    ["Inumin po 500 mg 1 tab BID", "Iinumin: 1 tableta, 2 beses isang araw (umaga at gabi)"],
    // 42 - insulin units
    ["10 units SC HS", "Iturok sa ilalim ng balat: 10 yunit, bago matulog"],
    // 43 - roman numeral
    ["i tab TID pc", "1 tableta, 3 beses isang araw (umaga, tanghali at gabi), pagkatapos kumain"],
    // 44 - dispensed quantity inside the sig is not the dose
    ["1 tab BID #14", "1 tableta, 2 beses isang araw (umaga at gabi)"],
    // 45 - after breakfast sets the slot AND the timing
    ["1 tab after breakfast", "1 tableta, isang beses isang araw (umaga), pagkatapos kumain"],
  ];

  it.each(cases)("%s", (input, expected) => {
    expect(parseSig(input).tagalog).toBe(expected);
  });

  it("has at least 30 full-sentence cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });
});

describe("sig parser: English output", () => {
  it("renders the product-spec example in English", () => {
    expect(parseSig("1 tab BID pc x 7 days").english).toBe(
      "1 tablet, twice a day (morning and evening), after meals, for 7 days",
    );
  });
  it("pluralises tablets and keeps mL", () => {
    expect(parseSig("2 tabs TID").english).toBe("2 tablets, 3 times a day (morning, noon and evening)");
    expect(parseSig("1 tsp BID").english).toBe("1 teaspoon (5 mL), twice a day (morning and evening)");
  });
  it("translates routes and maintenance", () => {
    expect(parseSig("1 tab PO OD maintenance").english).toBe("By mouth: 1 tablet, once a day (morning), every day, ongoing");
  });
});

describe("sig parser: structured output", () => {
  it("returns structured fields", () => {
    const p = parseSig("1 tab BID pc x 7 days");
    expect(p.amount).toEqual({ min: 1, unit: "tablet" });
    expect(p.frequency).toEqual({ code: "BID", perDay: 2 });
    expect(p.timing).toEqual({ kind: "PC" });
    expect(p.duration).toEqual({ kind: "days", value: 7 });
    expect(p.slots).toEqual(["umaga", "gabi"]);
    expect(p.slotsBasis).toBe("standard");
    expect(p.needsReview).toBe(false);
    expect(p.flags).toEqual([]);
  });

  it("maps frequencies to the five schedule slots", () => {
    expect(parseSig("1 tab TID").slots).toEqual(["umaga", "tanghali", "gabi"]);
    expect(parseSig("1 tab QID").slots).toEqual(["umaga", "tanghali", "hapon", "gabi"]);
    expect(parseSig("1 tab HS").slots).toEqual(["bago_matulog"]);
    expect(parseSig("1 tab q12h").slots).toEqual(["umaga", "gabi"]);
    expect(parseSig("1 tab in the afternoon").slots).toEqual(["hapon"]);
    expect(parseSig("1 tab at noon").slots).toEqual(["tanghali"]);
  });

  it("extracts hours for q-intervals including ranges", () => {
    expect(parseSig("1 tab q6h").frequency).toEqual({ code: "Q_HOURS", every: { min: 6 } });
    expect(parseSig("1 tab q4-6h PRN").frequency).toEqual({ code: "Q_HOURS", every: { min: 4, max: 6 } });
    expect(parseSig("1 tab every 8 hours").frequency).toEqual({ code: "Q_HOURS", every: { min: 8 } });
    expect(parseSig("1 tab tuwing 6 oras").frequency).toEqual({ code: "Q_HOURS", every: { min: 6 } });
  });

  it("treats lower-case 'po' as politeness, not a route", () => {
    expect(parseSig("1 tab BID po").route).toBeNull();
    expect(parseSig("1 tab BID PO").route).toEqual({ code: "PO" });
    // ...but "inumin" (drink) is explicitly by mouth
    expect(parseSig("inumin po 1 tab BID").route).toEqual({ code: "PO" });
  });

  it("keeps 'for ...' words verbatim and never turns them into 'para saan'", () => {
    const p = parseSig("1 tab q6h PRN for pain");
    expect(p.indicationRaw).toBe("pain");
    expect(p.tagalog).not.toMatch(/para saan|sakit/i);
    expect(p.flags.map((f) => f.code)).not.toContain("unrecognized_text");
  });
});

describe("sig parser: never guesses - flags for the reviewer", () => {
  const codes = (s: string, opts?: Parameters<typeof parseSig>[1]) => parseSig(s, opts).flags.map((f) => f.code);

  it("empty input is unreadable, not invented", () => {
    const p = parseSig("   ");
    expect(p.tagalog).toBe(UNREADABLE_TL);
    expect(p.needsReview).toBe(true);
    expect(codes("")).toEqual(["empty"]);
  });

  it("gibberish is unreadable, not invented", () => {
    const p = parseSig("zxq blorp");
    expect(p.tagalog).toBe(UNREADABLE_TL);
    expect(p.needsReview).toBe(true);
    expect(p.unrecognized).toEqual(["zxq", "blorp"]);
  });

  it("a part the reader could not read is flagged", () => {
    expect(codes("1 tab ??? pc")).toContain("unreadable_part");
    expect(parseSig("1 tab ??? pc").needsReview).toBe(true);
  });

  it("flags words it does not understand and does not drop them silently", () => {
    const p = parseSig("1 tab BID then 2 tabs OD");
    expect(p.needsReview).toBe(true);
    expect(p.unrecognized).toContain("then");
  });

  it("OD with no time of day is only a suggestion and is amber", () => {
    const p = parseSig("1 tab OD");
    expect(p.slotsBasis).toBe("assumed");
    expect(p.flags.map((f) => f.code)).toContain("slots_assumed");
  });

  it("OD with a written time of day is not assumed", () => {
    const p = parseSig("1 tab OD in the morning");
    expect(p.slotsBasis).toBe("written");
    expect(p.needsReview).toBe(false);
  });

  it("q8h and q6h slots are suggestions (amber); q4h cannot be placed", () => {
    expect(codes("1 tab q8h")).toContain("slots_assumed");
    expect(codes("1 tab q6h")).toContain("slots_assumed");
    expect(codes("1 tab q4h")).toContain("slots_unplaceable");
    expect(parseSig("1 tab q4h").slots).toEqual([]);
  });

  it("as-needed lines have no schedule slots and no slot flag", () => {
    const p = parseSig("1 tab q6h PRN");
    expect(p.slots).toEqual([]);
    expect(p.flags.map((f) => f.code)).not.toContain("slots_assumed");
  });

  it("PRN with no interval is flagged", () => {
    expect(codes("1 tab PRN")).toContain("prn_no_interval");
  });

  it("missing amount is flagged, never defaulted to 1", () => {
    const p = parseSig("BID pc x 7 days");
    expect(p.amount).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("missing_amount");
    expect(p.tagalog).not.toMatch(/^1 /);
  });

  it("missing frequency is flagged", () => {
    const p = parseSig("1 tab x 7 days");
    expect(p.frequency).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("missing_frequency");
  });

  it("a bare number has no unit and is flagged", () => {
    const p = parseSig("1 BID pc");
    expect(p.amount).toEqual({ min: 1, unit: null });
    expect(p.flags.map((f) => f.code)).toContain("missing_unit");
  });

  it("contradictory frequencies are not resolved by guessing", () => {
    const p = parseSig("1 tab BID TID");
    expect(p.frequency).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("frequency_conflict");
  });

  it("the same frequency written twice is not a conflict", () => {
    const p = parseSig("1 tab BID twice a day");
    expect(p.frequency).toEqual({ code: "BID", perDay: 2 });
    expect(p.flags.map((f) => f.code)).not.toContain("frequency_conflict");
  });

  it("contradictory meal timing is flagged", () => {
    const p = parseSig("1 tab BID ac pc");
    expect(p.timing).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("timing_conflict");
  });

  it("'x 7' without days/weeks is flagged", () => {
    const p = parseSig("1 tab BID x 7");
    expect(p.duration).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("duration_unit_missing");
  });

  it("'OD' next to eye drops is ambiguous (once daily vs right eye) and is flagged", () => {
    const p = parseSig("1 gtt OD");
    expect(p.frequency).toBeNull();
    expect(p.flags.map((f) => f.code)).toContain("od_ambiguous_eye");
    expect(codes("1 drop OD", { dosageForm: "drops" })).toContain("od_ambiguous_eye");
  });

  it("'once a day' words next to drops are fine", () => {
    const p = parseSig("1 drop once a day");
    expect(p.frequency).toEqual({ code: "OD", perDay: 1 });
    expect(p.flags.map((f) => f.code)).not.toContain("od_ambiguous_eye");
  });

  it("range amounts are flagged", () => {
    expect(codes("1-2 tabs q6h PRN")).toContain("amount_range");
  });

  it("odd fractions of a tablet are flagged", () => {
    expect(codes("0.3 tab OD")).toContain("odd_fraction");
  });

  it("unit that does not fit the dosage form is flagged", () => {
    expect(codes("1 tab TID", { dosageForm: "syrup" })).toContain("unit_form_mismatch");
    expect(codes("1 tsp TID", { dosageForm: "syrup" })).not.toContain("unit_form_mismatch");
  });

  it("time-of-day count that disagrees with BID/TID is flagged", () => {
    expect(codes("1 tab TID in the morning")).toContain("slots_mismatch");
  });

  it("two different amounts are flagged, but tsp = mL is not", () => {
    expect(codes("1 tab or 2 caps BID")).toContain("multiple_amounts");
    expect(codes("1 tsp (5 mL) TID")).not.toContain("multiple_amounts");
    expect(codes("1 tsp 10 mL TID")).toContain("multiple_amounts");
  });

  it("ignores drug-name words given by the caller", () => {
    const p = parseSig("Amlodipine 1 tab OD", { ignoreWords: ["Amlodipine"] });
    expect(p.unrecognized).toEqual([]);
  });
});

describe("compose / format helpers", () => {
  it("recomposes the sentence from edited structured fields", () => {
    const p = parseSig("1 tab OD");
    const edited = composeSig(
      { ...p, frequency: { code: "BID", perDay: 2 }, slots: ["umaga", "gabi"], timing: { kind: "PC" } },
      "tl",
    );
    expect(edited).toBe("1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain");
  });

  it("formats fractions and spoons for reading aloud without symbols", () => {
    expect(formatAmount({ min: 0.5, unit: "tablet" }, "tl")).toBe("kalahating tableta");
    expect(formatAmount({ min: 0.25, unit: "tablet" }, "tl")).toBe("isang-kapat na tableta");
    expect(formatAmount({ min: 2, unit: "tsp" }, "tl")).toBe("2 kutsarita (10 mL)");
    expect(formatAmount({ min: 2.5, unit: "ml" }, "tl")).toBe("2.5 mL");
  });
});
