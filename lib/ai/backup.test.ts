import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareProvider } from "./cloudflare";
import { BACKUP_CONFIDENCE_CAP, capConfidence, PRESCRIPTION_JSON_SCHEMA, parseExtraction } from "./extract";
import { generateWithFallback, type AiProvider } from "./provider";
import { review } from "./testkit";
import { SAMPLES } from "../samples";

afterEach(() => vi.unstubAllGlobals());

describe("backup AI: confidence is not trusted", () => {
  it("caps every confidence at 0.7 so each field is amber and must be confirmed", () => {
    const overconfident = {
      ...SAMPLES[2].extracted,
      medicines: SAMPLES[2].extracted.medicines.map((m) => ({ ...m, confidence: { generic_name: 1, strength: 1, sig_raw: 1 } })),
    };
    const capped = capConfidence(overconfident, BACKUP_CONFIDENCE_CAP);
    for (const m of capped.medicines) expect(Math.max(...Object.values(m.confidence))).toBeLessThanOrEqual(0.7);
    // and through the review gate that means nothing is pre-approved
    const entries = capped.medicines.filter((m) => m.generic_name).map((m, i) => review.entry(m, `b${i}`));
    expect(entries.every((e) => review.pending(e).length >= 3)).toBe(true);
  });

  it("never raises a low confidence", () => {
    const low = { ...SAMPLES[0].extracted, medicines: [{ ...SAMPLES[0].extracted.medicines[0], confidence: { generic_name: 0.2, strength: 0.3, sig_raw: 0.1 } }] };
    expect(capConfidence(low, 0.7).medicines[0].confidence).toEqual({ generic_name: 0.2, strength: 0.3, sig_raw: 0.1 });
  });
});

describe("the last provider gets all the remaining time", () => {
  it("an earlier provider is capped, the final fallback may use everything left", async () => {
    const seen: number[] = [];
    const make = (name: string, fail: boolean): AiProvider => ({
      name,
      generate: async (r) => {
        seen.push(r.timeoutMs);
        if (fail) throw new Error("no");
        return "{}";
      },
    });
    await generateWithFallback([make("a", true), make("b", false)], { prompt: "x" }, Date.now() + 50_000, 11_000);
    expect(seen[0]).toBe(11_000); // first: capped
    expect(seen[1]).toBeGreaterThan(30_000); // last: everything that is left
  });
});

describe("Cloudflare provider (as measured live on 2026-11-02)", () => {
  const img = { mimeType: "image/png", base64: "AAAA" };

  it("sends the schema as response_format.json_schema and a data-URL image", async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ success: true, result: { response: { ok: 1 } } }));
    });
    await new CloudflareProvider("acct", "tok").generate({ prompt: "p", image: img, json: true, jsonSchema: PRESCRIPTION_JSON_SCHEMA, timeoutMs: 5000 });
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: PRESCRIPTION_JSON_SCHEMA });
    expect(JSON.stringify(body)).toContain("data:image/png;base64,AAAA");
  });

  it("handles a response that is already an object (not a string)", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ success: true, result: { response: SAMPLES[0].extracted } })));
    const text = await new CloudflareProvider("acct", "tok").generate({ prompt: "p", image: img, json: true, jsonSchema: PRESCRIPTION_JSON_SCHEMA, timeoutMs: 5000 });
    expect(parseExtraction(text).ok).toBe(true);
  });

  it("retries without the schema if the schema is rejected (400)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      return b.response_format
        ? new Response(JSON.stringify({ success: false, errors: [{ code: 5006, message: "bad" }] }), { status: 400 })
        : new Response(JSON.stringify({ success: true, result: { response: "{}" } }));
    });
    await new CloudflareProvider("acct", "tok").generate({ prompt: "p", image: img, json: true, jsonSchema: PRESCRIPTION_JSON_SCHEMA, timeoutMs: 5000 });
    expect(bodies).toHaveLength(2);
    expect(bodies[1].response_format).toBeUndefined();
  });

  it("accepts Meta's licence once if the model asks for it, then retries", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      seen.push(b.prompt === "agree" ? "agree" : "run");
      if (seen.filter((s) => s === "run").length === 1 && b.prompt !== "agree") return new Response(JSON.stringify({ success: false, errors: [{ code: 5016 }] }), { status: 403 });
      return new Response(JSON.stringify({ success: true, result: { response: "{}" } }));
    });
    await new CloudflareProvider("acct", "tok").generate({ prompt: "p", image: img, json: true, timeoutMs: 5000 });
    expect(seen).toEqual(["run", "agree", "run"]);
  });

  it("never puts the API token in an error message", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ success: false, errors: [{ message: "bad token tok-SECRET-123" }] }), { status: 403 }));
    await expect(new CloudflareProvider("acct", "tok-SECRET-123").generate({ prompt: "p", json: true, timeoutMs: 5000 })).rejects.toThrow(/\*\*\*/);
    await expect(new CloudflareProvider("acct", "tok-SECRET-123").generate({ prompt: "p", json: true, timeoutMs: 5000 })).rejects.not.toThrow(/tok-SECRET-123/);
  });
});
