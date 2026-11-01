"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";

/** Placeholder: the consent + upload flow is built in Milestone 2. */
export default function UploadPage() {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-brand">{t.upload.title}</h1>
      <p className="rounded-2xl border-2 border-amber-line bg-amber-soft p-4 text-amber-ink">{t.upload.comingSoon}</p>
      <Link href="/samples" className="btn btn-primary btn-xl">
        {t.upload.seeSamples}
      </Link>
    </div>
  );
}
