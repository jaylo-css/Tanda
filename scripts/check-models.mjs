/**
 * Checks your Gemini key against the models in lib/ai/config.ts:
 *   node scripts/check-models.mjs
 * 1. ListModels: which Flash models exist for this key
 * 2. For each candidate, sends the typed SAMPLE prescription image and reports
 *    whether image input works and how long it takes.
 * The key is read from .env.local and is never printed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  /* fall back to the real environment */
}
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is not set (.env.local).");
  process.exit(1);
}
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "x-goog-api-key": key, "content-type": "application/json" };

const list = await fetch(`${BASE}/models?pageSize=200`, { headers });
console.log("ListModels HTTP", list.status);
if (!list.ok) {
  console.error((await list.text()).slice(0, 300).replace(key, "***"));
  process.exit(1);
}
const models = (await list.json()).models ?? [];
const flash = models
  .filter((m) => /flash/i.test(m.name) && m.supportedGenerationMethods?.includes("generateContent"))
  .map((m) => m.name.replace("models/", ""));
console.log("Flash models with generateContent:", flash.join(", ") || "(none)");

const candidates = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
const img = readFileSync(path.join(root, "public/samples/sample-1-typed.png")).toString("base64");

for (const model of candidates) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: 'Return ONLY JSON like {"patient_name":"","first_medicine":""} copied from this prescription image.' },
              { inline_data: { mime_type: "image/png", data: img } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(40_000),
    });
    const ms = Date.now() - t0;
    const body = await res.text();
    if (!res.ok) {
      console.log(`${model}: HTTP ${res.status} in ${ms} ms -> ${body.slice(0, 220).replace(key, "***").replace(/\s+/g, " ")}`);
      continue;
    }
    const j = JSON.parse(body);
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    console.log(`${model}: OK in ${ms} ms -> ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    if (j.usageMetadata) console.log(`   tokens: ${JSON.stringify(j.usageMetadata)}`);
  } catch (e) {
    console.log(`${model}: ERROR ${e.name}: ${String(e.message).replace(key, "***")}`);
  }
}
