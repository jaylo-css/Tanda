"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLang } from "@/components/LangProvider";
import { PrescriptionView } from "@/components/PrescriptionView";
import { useSession } from "@/components/SessionProvider";
import { buildPrescriptionData } from "@/lib/prescription";

/** The clear, large-print Tagalog prescription. Only reachable after a human has confirmed every line. */
export default function ResultPage() {
  const { t } = useLang();
  const { s, reopen } = useSession();

  const data = useMemo(
    () =>
      s.finalizedAt
        ? buildPrescriptionData({ header: s.header, reviewer: s.reviewer, entries: s.entries, finalizedAt: s.finalizedAt })
        : null,
    [s.finalizedAt, s.header, s.reviewer, s.entries],
  );

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-xl">{t.result.notFinal}</p>
        <Link href="/review" className="btn btn-primary btn-xl">{t.result.backToReview}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PrescriptionView
        data={data}
        actions={
          <Link href="/review" onClick={reopen} className="btn btn-secondary">
            {t.result.edit}
          </Link>
        }
      />
    </div>
  );
}
