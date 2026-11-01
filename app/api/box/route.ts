import { NextResponse } from "next/server";
import { AI_CONFIG } from "@/lib/ai/config";
import { getProviders } from "@/lib/ai";
import { ReadError, readBox } from "@/lib/ai/extract";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { readImageUpload, UploadError } from "@/lib/server/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST multipart/form-data { image } -> { ok, label } : text printed on a medicine box.
 * This is only a HELPER. The matching to a prescription line is suggested by the client and
 * always confirmed by a person. The photo is not stored.
 */
export async function POST(req: Request) {
  let upload;
  try {
    upload = await readImageUpload(req);
  } catch (e) {
    const err = e instanceof UploadError ? e : null;
    return NextResponse.json({ ok: false, code: err?.code ?? "bad_image", tl: err?.tl ?? "Hindi mabasa ang litrato.", en: err?.en ?? "The photo could not be read." }, { status: 400 });
  }

  const limit = checkRateLimit(`box:${clientIp(req.headers)}`, AI_CONFIG.limits.boxRequestsPerHourPerIp, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", tl: "Masyadong maraming pagsubok. Maaari mo pa ring ilagay ang litrato nang hindi binabasa ng AI.", en: "Too many tries. You can still add the photo without the AI reading it." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  try {
    const { data, provider } = await readBox(getProviders(), upload.image, Date.now() + AI_CONFIG.limits.requestTimeoutMs);
    return NextResponse.json({ ok: true, provider, label: data });
  } catch (e) {
    const code = e instanceof ReadError ? e.code : "ai_failed";
    console.warn(`[box] ${code}`);
    return NextResponse.json(
      { ok: false, code, tl: "Hindi nabasa ang label. Maaari mo pa ring gamitin ang litrato.", en: "The label could not be read. You can still use the photo." },
      { status: 502 },
    );
  }
}
