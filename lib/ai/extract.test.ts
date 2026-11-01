import { describe, expect, it } from "vitest";
import { extractJsonObject, parseBoxLabel, parseExtraction, readPrescription } from "./extract";
import { AiError, generateWithFallback, type AiProvider } from "./provider";
import { SAMPLES } from "../samples";

const good = SAMPLES[0].extracted;

describe("JSON validator rejects bad model output", () => {
  it("accepts a valid prescription", () => {
    const r = parseExtraction(JSON.stringify(good));
    expect(r.ok).toBe(true);
  });

  it("tolerates ```json fences and chatter around valid JSON", () => {
    const r = parseExtraction("Here you go:\n```json\n" + JSON.stringify(good) + "\n```\nHope that helps!");
    expect(r.ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parseExtraction("I cannot read this prescription.").ok).toBe(false);
    expect(parseExtraction("").ok).toBe(false);
  });

  it("rejects truncated JSON", () => {
    expect(parseExtraction(JSON.stringify(good).slice(0, 80)).ok).toBe(false);
  });

  it("rejects when medicines is not an array", () => {
    expect(parseExtraction(JSON.stringify({ ...good, medicines: "amlodipine" })).ok).toBe(false);
    expect(parseExtraction(JSON.stringify({ doctor: {}, patient: {} })).ok).toBe(false);
  });

  it("rejects confidence outside 0..1 or missing", () => {
    const m = good.medicines[0];
    const bad1 = { ...good, medicines: [{ ...m, confidence: { ...m.confidence, strength: 1.4 } }] };
    const bad2 = { ...good, medicines: [{ ...m, confidence: { generic_name: 0.9 } }] };
    const bad3 = { ...good, medicines: [{ ...m, confidence: { generic_name: "high", strength: 1, sig_raw: 1 } }] };
    expect(parseExtraction(JSON.stringify(bad1)).ok).toBe(false);
    expect(parseExtraction(JSON.stringify(bad2)).ok).toBe(false);
    expect(parseExtraction(JSON.stringify(bad3)).ok).toBe(false);
  });

  it("rejects absurdly many medicines", () => {
    const many = { ...good, medicines: Array.from({ length: 31 }, () => good.medicines[0]) };
    expect(parseExtraction(JSON.stringify(many)).ok).toBe(false);
  });

  it("coerces an unknown dosage form to 'other' instead of rejecting the whole read", () => {
    const r = parseExtraction(JSON.stringify({ ...good, medicines: [{ ...good.medicines[0], dosage_form: "lozenge" }] }));
    expect(r.ok && r.data.medicines[0].dosage_form).toBe("other");
  });

  it("never trusts a high confidence on an empty field", () => {
    const m = { ...good.medicines[0], strength: "", confidence: { generic_name: 0.99, strength: 0.99, sig_raw: 0.99 } };
    const r = parseExtraction(JSON.stringify({ ...good, medicines: [m] }));
    expect(r.ok && r.data.medicines[0].confidence.strength).toBeLessThanOrEqual(0.4);
  });

  it("extractJsonObject handles braces inside strings", () => {
    expect(extractJsonObject('x {"a":"}{","b":1} y')).toEqual({ a: "}{", b: 1 });
  });

  it("validates box label JSON too", () => {
    const ok = { generic_name: "Amlodipine", brand_name: "", strength: "5 mg", dosage_form: "tablet", confidence: { generic_name: 0.9, strength: 0.9 } };
    expect(parseBoxLabel(JSON.stringify(ok)).ok).toBe(true);
    expect(parseBoxLabel(JSON.stringify({ ...ok, confidence: { generic_name: 2, strength: 1 } })).ok).toBe(false);
  });
});

/** A fake provider that answers from a script. */
function scripted(answers: Array<string | Error>): AiProvider & { calls: number; prompts: string[] } {
  const p = {
    name: "fake",
    calls: 0,
    prompts: [] as string[],
    async generate(req: { prompt: string }) {
      p.prompts.push(req.prompt);
      const a = answers[Math.min(p.calls++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return a;
    },
  };
  return p;
}
const img = { mimeType: "image/png", base64: "AAAA" };
const farFuture = () => Date.now() + 60_000;

describe("reading with retry", () => {
  it("retries ONCE on invalid JSON and then succeeds", async () => {
    const p = scripted(["not json", JSON.stringify(good)]);
    const r = await readPrescription([p], img, farFuture());
    expect(r.data.patient.name).toBe(good.patient.name);
    expect(p.calls).toBe(2);
    expect(p.prompts[1]).toMatch(/ONLY the JSON object/);
  });

  it("gives up after the one retry with invalid_output (UI then offers manual entry)", async () => {
    const p = scripted(["nope", "still nope", JSON.stringify(good)]);
    await expect(readPrescription([p], img, farFuture())).rejects.toMatchObject({ code: "invalid_output" });
    expect(p.calls).toBe(2);
  });

  it("reports ai_failed when the provider errors, and no_provider when none is configured", async () => {
    await expect(readPrescription([scripted([new AiError("timeout", "slow")])], img, farFuture())).rejects.toMatchObject({ code: "ai_failed" });
    await expect(readPrescription([], img, farFuture())).rejects.toMatchObject({ code: "no_provider" });
  });

  it("falls back to the second provider when the first one fails", async () => {
    const a = scripted([new AiError("quota", "429")]);
    const b = { ...scripted([JSON.stringify(good)]), name: "second" };
    const r = await generateWithFallback([a, b], { prompt: "x" }, farFuture(), 5_000);
    expect(r.provider).toBe("second");
  });
});
