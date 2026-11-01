import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLES } from "@/lib/samples";
import { resetRateLimits } from "@/lib/rateLimit";
import { AiError, type AiProvider } from "@/lib/ai/provider";

// Shrink the budgets so "slower than 15 s" can be tested in about 2 s. (The route stops calling the AI
// when under 1.5 s remain, so the test budget has to be comfortably above that.)
vi.mock("@/lib/ai/config", async (orig) => {
  const real = (await orig()) as { AI_CONFIG: Record<string, unknown> };
  const cfg = real.AI_CONFIG as { limits: Record<string, unknown>; gemini: Record<string, unknown> };
  return { ...real, AI_CONFIG: { ...cfg, limits: { ...cfg.limits, requestTimeoutMs: 2000, uploadTimeoutMs: 2000 }, gemini: { ...cfg.gemini, perModelTimeoutMs: 500 } } };
});

let providers: AiProvider[] = [];
vi.mock("@/lib/ai", async () => {
  const real = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return { ...real, getProviders: () => providers };
});

import { POST } from "./route";

const file = (name: string) => readFileSync(path.join(process.cwd(), "public", "samples", name));
const sampleBytes = file(SAMPLES[2].image.replace("/samples/", "")); // the messy sample
const realUploadBytes = file("box-amlodipine-10mg.png"); // NOT one of the 3 prescription samples

function req(bytes: Buffer, ip = "9.9.9.9", type = "image/png") {
  const form = new FormData();
  form.append("image", new File([new Uint8Array(bytes)], "x.png", { type }));
  return new Request("http://localhost/api/extract", { method: "POST", body: form, headers: { "x-forwarded-for": ip } });
}

const failing: AiProvider = { name: "fake", generate: async () => { throw new AiError("quota", "429 quota"); } };
const slow: AiProvider = { name: "fake", generate: (r) => new Promise((_, rej) => setTimeout(() => rej(new AiError("timeout", "slow")), r.timeoutMs + 50)) };
const garbage: AiProvider = { name: "fake", generate: async () => "I am sorry, I cannot read this." };
const good: AiProvider = { name: "fake", generate: async () => JSON.stringify(SAMPLES[0].extracted) };

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("DEMO_MODE", "true");
  providers = [good];
});
afterEach(() => vi.unstubAllEnvs());

describe("demo mode: the stage demo never breaks", () => {
  it("normal case: the AI answers and its result is used (source=ai)", async () => {
    const res = await POST(req(realUploadBytes));
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.source).toBe("ai");
  });

  it("AI fails -> a SAMPLE image gets its pre-saved result", async () => {
    providers = [failing];
    const j = await (await POST(req(sampleBytes))).json();
    expect(j).toMatchObject({ ok: true, source: "demo", sampleId: SAMPLES[2].id });
    expect(j.data.patient.name).toBe(SAMPLES[2].extracted.patient.name);
  });

  it("AI slower than the time limit -> a SAMPLE image gets its pre-saved result", async () => {
    providers = [slow];
    const t0 = Date.now();
    const j = await (await POST(req(sampleBytes))).json();
    expect(j.source).toBe("demo");
    expect(Date.now() - t0).toBeLessThan(4000); // gave up at the (shrunken) limit instead of hanging
  });

  it("AI returns garbage twice -> a SAMPLE image still gets its pre-saved result", async () => {
    providers = [garbage];
    expect((await (await POST(req(sampleBytes))).json()).source).toBe("demo");
  });

  it("no AI configured at all -> the SAMPLE still works", async () => {
    providers = [];
    expect((await (await POST(req(sampleBytes))).json()).source).toBe("demo");
  });

  it("a REAL upload never receives demo data: it gets a friendly error that offers typing by hand", async () => {
    providers = [failing];
    const res = await POST(req(realUploadBytes));
    const j = await res.json();
    expect(res.status).toBe(502);
    expect(j).toMatchObject({ ok: false, code: "ai_failed", manual: true });
    expect(j.tl).toMatch(/i-type na lang ang mga gamot/);
    expect(j.data).toBeUndefined();
  });

  it("invalid JSON on a real upload (after one retry) -> invalid_output error, manual entry offered", async () => {
    providers = [garbage];
    const res = await POST(req(realUploadBytes));
    const j = await res.json();
    expect(j).toMatchObject({ ok: false, code: "invalid_output", manual: true });
  });

  it("DEMO_MODE off -> even a sample is not replaced by saved data", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    providers = [failing];
    const j = await (await POST(req(sampleBytes))).json();
    expect(j.ok).toBe(false);
  });

  it("an image that only CLAIMS to be a sample (different bytes) gets no demo data", async () => {
    providers = [failing];
    const tweaked = Buffer.concat([sampleBytes, Buffer.from([0])]); // one extra byte: not our sample any more
    expect((await (await POST(req(tweaked))).json()).ok).toBe(false);
  });
});

describe("rate limit: 10 AI requests per hour per IP", () => {
  it("the 11th real upload from one IP is blocked with a clear message and a Retry-After header", async () => {
    for (let i = 0; i < 10; i++) expect((await POST(req(realUploadBytes, "1.1.1.1"))).status).toBe(200);
    const res = await POST(req(realUploadBytes, "1.1.1.1"));
    const j = await res.json();
    expect(res.status).toBe(429);
    expect(j.code).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(j.tl).toMatch(/Masyadong maraming pagsubok/);
  });

  it("another IP is not affected", async () => {
    for (let i = 0; i < 10; i++) await POST(req(realUploadBytes, "1.1.1.1"));
    expect((await POST(req(realUploadBytes, "2.2.2.2"))).status).toBe(200);
  });

  it("when rate limited, a SAMPLE still works from saved data (a shared venue Wi-Fi cannot lock out the demo)", async () => {
    for (let i = 0; i < 10; i++) await POST(req(realUploadBytes, "1.1.1.1"));
    const j = await (await POST(req(sampleBytes, "1.1.1.1"))).json();
    expect(j).toMatchObject({ ok: true, source: "demo" });
  });
});

describe("input checks", () => {
  it("rejects a non-image upload", async () => {
    const res = await POST(req(Buffer.from("hello"), "3.3.3.3", "text/plain"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_image");
  });

  it("rejects an oversized photo", async () => {
    const res = await POST(req(Buffer.alloc(5 * 1024 * 1024), "3.3.3.3"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("too_large");
  });

  it("rejects a request with no photo", async () => {
    const res = await POST(new Request("http://localhost/api/extract", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });
});
