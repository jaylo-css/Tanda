"use client";

import Link from "next/link";
import { useLang } from "./LangProvider";

/** Shown for a missing, expired or malformed family link (the reason is deliberately not revealed). */
export function NotFoundNotice() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold text-brand">{t.shared.title}</h1>
      <p className="text-xl">{t.shared.body}</p>
      <Link href="/" className="btn btn-primary btn-xl">{t.shared.home}</Link>
    </div>
  );
}
