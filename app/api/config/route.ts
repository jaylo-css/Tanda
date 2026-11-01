import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Tells the browser which optional features this deployment has. Never returns any key. */
export async function GET() {
  return NextResponse.json({ sharing: getSupabase() !== null });
}
