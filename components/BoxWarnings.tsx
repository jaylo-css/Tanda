"use client";

import { useLang } from "./LangProvider";
import type { BoxWarning } from "@/lib/review";

/**
 * Box-vs-prescription warnings. Red = a real difference (strength or name), amber = could not compare.
 * Always shown with a ⚠ symbol and words, not colour alone.
 */
export function BoxWarnings({ warnings, large }: { warnings: BoxWarning[]; large?: boolean }) {
  const { lang } = useLang();
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w) => (
        <p
          key={w.kind}
          role="alert"
          className={`rounded-xl border-2 p-3 font-bold ${large ? "text-xl" : "text-base"} ${
            w.severity === "danger" ? "border-danger bg-danger-soft text-danger" : "border-amber-line bg-amber-soft text-amber-ink"
          }`}
        >
          <span aria-hidden="true">⚠ </span>
          {lang === "tl" ? w.tl : w.en}
        </p>
      ))}
    </div>
  );
}
