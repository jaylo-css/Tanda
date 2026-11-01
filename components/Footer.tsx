"use client";

import { useLang } from "./LangProvider";
import { DISCLAIMER, TAGLINE } from "@/lib/i18n";

export function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="no-print mt-12 border-t-2 border-line bg-white">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-base text-muted">
        <p className="font-bold text-ink">{DISCLAIMER[lang]}</p>
        <p>{t.footer.privacy}</p>
        <p>
          <span className="font-bold">Tanda</span> &mdash; {TAGLINE[lang]}. {t.footer.demo}
        </p>
      </div>
    </footer>
  );
}
