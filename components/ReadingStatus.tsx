"use client";

import { useLang } from "./LangProvider";
import { useSession } from "./SessionProvider";

/** Loading text in Tagalog ("Binabasa ang reseta...") and a clear retry / type-by-hand choice on error. */
export function ReadingStatus({ onRetry, onManual }: { onRetry?: () => void; onManual: () => void }) {
  const { s, reset } = useSession();
  const { lang, t } = useLang();

  if (s.status === "preparing" || s.status === "reading") {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <span aria-hidden="true" className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <div>
          <p className="text-xl font-bold text-brand-dark">{s.status === "preparing" ? t.upload.preparing : t.upload.reading}</p>
          {s.status === "reading" && <p className="text-base">{t.upload.readingSub}</p>}
        </div>
      </div>
    );
  }

  if (s.status === "error" && s.error) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl border-2 border-danger bg-danger-soft p-4">
        <p className="text-xl font-bold text-danger">{t.upload.errorTitle}</p>
        <p>{lang === "tl" ? s.error.tl : s.error.en}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {onRetry && (
            <button type="button" className="btn btn-primary flex-1" onClick={onRetry}>
              {t.common.tryAgain}
            </button>
          )}
          <button type="button" className="btn btn-secondary flex-1" onClick={onManual}>
            {t.upload.manual}
          </button>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            {t.common.back}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
