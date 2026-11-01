"use client";

import { useLang } from "./LangProvider";

/** First tab stop on every page: lets keyboard and switch users jump past the header. */
export function SkipLink() {
  const { t } = useLang();
  return (
    <a
      href="#main"
      className="no-print sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-brand"
    >
      {t.skipToContent}
    </a>
  );
}
