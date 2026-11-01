import { NextResponse } from "next/server";
import { getSupabase, isShareReady } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Tells the browser which optional features this deployment really has. Never returns any key.
 * `sharing` is true only if Supabase is configured AND its "shares" table exists, so the Share
 * button never shows up where it would only fail.
 */
export async function GET() {
  const sb = getSupabase();
  return NextResponse.json({ sharing: sb !== null && (await isShareReady(sb)) });
}
