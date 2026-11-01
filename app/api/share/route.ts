import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sharePayloadSchema } from "@/lib/shareSchema";
import { createShare, getSupabase } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

/** POST JSON { data, photos } -> { ok, id, expiresAt }. 404 when Supabase is not configured. */
export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, code: "sharing_off" }, { status: 404 });

  const limit = checkRateLimit(`share:${clientIp(req.headers)}`, 20, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return NextResponse.json({ ok: false, code: "too_large" }, { status: 413 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const parsed = sharePayloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });

  const result = await createShare(sb, parsed.data);
  if ("error" in result) {
    console.warn("[share] failed:", result.error.slice(0, 200));
    return NextResponse.json({ ok: false, code: "share_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.id, expiresAt: result.expiresAt });
}
