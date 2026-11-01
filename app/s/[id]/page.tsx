import type { Metadata } from "next";
import { NotFoundNotice } from "@/components/NotFoundNotice";
import { SharedPrescription } from "@/components/SharedPrescription";
import { getSupabase, readShare } from "@/lib/server/supabase";

// Always rendered fresh: expiry must be checked on every visit, and photo links are short-lived.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ang Gamot - Tanda",
  // a private family link: keep it out of search engines and do not leak it through the Referer header
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return <NotFoundNotice />;
  let result;
  try {
    result = await readShare(sb, id);
  } catch {
    return <NotFoundNotice />;
  }
  if (result.status !== "ok") return <NotFoundNotice />;
  return <SharedPrescription data={result.data} photoUrls={result.photoUrls} expiresAt={result.expiresAt} />;
}
