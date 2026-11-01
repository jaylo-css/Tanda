"use client";

import Link from "next/link";
import { useLang } from "./LangProvider";
import { Logo } from "./Logo";
import type { Lang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang, t } = useLang();
  const options: Lang[] = ["tl", "en"];
  return (
    <div role="group" aria-label={t.lang.label} className="flex overflow-hidden rounded-xl border-2 border-brand">
      {options.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={`min-h-12 min-w-14 px-3 text-base font-bold ${
              active ? "bg-brand text-white" : "bg-white text-brand hover:bg-brand-soft"
            }`}
          >
            {code === "tl" ? "TL" : "EN"}
            <span className="sr-only"> {t.lang[code]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Header() {
  const { t } = useLang();
  return (
    <header className="no-print border-b-2 border-line bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex min-h-12 items-center gap-3 text-brand" aria-label={`${t.appName} - ${t.nav.home}`}>
          <Logo />
          <span className="text-2xl font-bold tracking-tight">{t.appName}</span>
        </Link>
        <LanguageToggle />
        <nav aria-label="Main" className="flex w-full gap-2 text-base font-bold">
          <Link href="/samples" className="flex min-h-12 items-center rounded-lg px-3 text-brand underline-offset-4 hover:underline">
            {t.nav.samples}
          </Link>
          <Link href="/about" className="flex min-h-12 items-center rounded-lg px-3 text-brand underline-offset-4 hover:underline">
            {t.nav.about}
          </Link>
        </nav>
      </div>
    </header>
  );
}
