import { NextResponse } from "next/server";
import { AI_CONFIG } from "@/lib/ai/config";
import { getProviders } from "@/lib/ai";
import { ReadError, readPrescription } from "@/lib/ai/extract";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getSample } from "@/lib/samples";
import { readImageUpload, UploadError } from "@/lib/server/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Fail = { ok: false; code: string; tl: string; en: string; manual: true };
const fail = (status: number, code: string, tl: string, en: string, headers?: HeadersInit) =>
  NextResponse.json<Fail>({ ok: false, code, tl, en, manual: true }, { status, headers });

/**
 * POST multipart/form-data { image }  ->  { ok, source, provider, data: ExtractedPrescription }
 *
 * - The image is processed in memory and never stored.
 * - AI output is validated with zod; one retry on invalid JSON, then an error that lets the
 *   user type the medicines by hand.
 * - Demo mode (DEMO_MODE=true): ONLY for byte-identical synthetic sample images, if the AI
 *   fails, is rate-limited, or takes longer than 15 s, the pre-saved result is returned.
 */
export async function POST(req: Request) {
  let upload;
  try {
    upload = await readImageUpload(req);
  } catch (e) {
    if (e instanceof UploadError) return fail(400, e.code, e.tl, e.en);
    return fail(400, "bad_image", "Hindi mabasa ang litrato.", "The photo could not be read.");
  }

  const demoOn = process.env.DEMO_MODE === "true";
  const sample = upload.sampleId ? getSample(upload.sampleId) : undefined;
  const demoResult = () =>
    sample && demoOn
      ? NextResponse.json({ ok: true, source: "demo", provider: "pre-saved", sampleId: sample.id, data: sample.extracted })
      : null;

  const limit = checkRateLimit(`extract:${clientIp(req.headers)}`, AI_CONFIG.limits.requestsPerHourPerIp, 3_600_000);
  if (!limit.allowed) {
    const demo = demoResult();
    if (demo) return demo;
    return fail(
      429,
      "rate_limited",
      `Masyadong maraming pagsubok. Subukan ulit pagkalipas ng ${Math.ceil(limit.retryAfterSec / 60)} minuto, o i-type na lang ang mga gamot.`,
      `Too many tries. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes, or type the medicines by hand.`,
      { "retry-after": String(limit.retryAfterSec) },
    );
  }

  const providers = getProviders();
  const budget = sample ? AI_CONFIG.limits.requestTimeoutMs : AI_CONFIG.limits.uploadTimeoutMs;
  try {
    const { data, provider } = await readPrescription(providers, upload.image, Date.now() + budget);
    return NextResponse.json({ ok: true, source: "ai", provider, sampleId: sample?.id ?? null, data });
  } catch (e) {
    const code = e instanceof ReadError ? e.code : "ai_failed";
    // server log: reason only, never the image or any key
    console.warn(`[extract] ${code}${sample ? ` (sample ${sample.id})` : ""}: ${e instanceof Error ? e.message.slice(0, 200) : ""}`);
    const demo = demoResult();
    if (demo) return demo;
    if (code === "no_provider") {
      return fail(503, code, "Walang AI na naka-set sa serbisyong ito. I-type na lang ang mga gamot.", "No AI is set up for this service. Please type the medicines by hand.");
    }
    if (code === "invalid_output") {
      return fail(502, code, "Hindi mabasa nang maayos ng AI ang reseta. Subukan ulit, o i-type na lang ang mga gamot.", "The AI could not read the prescription properly. Try again, or type the medicines by hand.");
    }
    return fail(502, code, "Hindi nakasagot ang AI ngayon. Subukan ulit, o i-type na lang ang mga gamot.", "The AI did not answer right now. Try again, or type the medicines by hand.");
  }
}
