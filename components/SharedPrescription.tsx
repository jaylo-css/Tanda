"use client";

import { useMemo } from "react";
import { useLang } from "./LangProvider";
import { PrescriptionScreen } from "./PrescriptionScreen";
import { fromShared, type SharedData } from "@/lib/shareSchema";

/** Read-only family view: same clear prescription, schedule and read-aloud, with the expiry date. */
export function SharedPrescription({ data, photoUrls, expiresAt }: { data: SharedData; photoUrls: Record<string, string>; expiresAt: string }) {
  const { t } = useLang();
  const view = useMemo(() => fromShared(data, photoUrls), [data, photoUrls]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="no-print rounded-xl border-2 border-line bg-card p-3 text-base font-bold">{t.shared.readOnly}</p>
      <PrescriptionScreen data={view} expiresAt={expiresAt} />
    </div>
  );
}
