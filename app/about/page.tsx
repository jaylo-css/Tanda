"use client";

import { useLang } from "@/components/LangProvider";

export default function AboutPage() {
  const { t } = useLang();
  const a = t.about;
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand">{a.title}</h1>
        <p className="text-lg">{a.lead}</p>
      </header>

      <section aria-labelledby="why" className="space-y-3">
        <h2 id="why" className="text-2xl font-bold">
          {a.whyTitle}
        </h2>
        <ul className="space-y-3">
          {a.stats.map((s) => (
            <li key={s.figure} className="rounded-2xl border-2 border-line bg-card p-4">
              <p>
                <span className="mr-2 text-4xl font-bold text-brand">{s.figure}</span>
                {s.text}
              </p>
              <p className="mt-1 text-base text-muted">{s.source}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="space-y-3">
        <h2 id="how" className="text-2xl font-bold">
          {a.howTitle}
        </h2>
        <ol className="list-decimal space-y-2 pl-6">
          {a.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="rules" className="space-y-3 rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <h2 id="rules" className="text-2xl font-bold text-brand-dark">
          {a.rulesTitle}
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          {a.rules.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="privacy" className="space-y-3">
        <h2 id="privacy" className="text-2xl font-bold">
          {a.privacyTitle}
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          {a.privacy.map((line, i) => (
            <li key={line} className={i === a.privacy.length - 1 ? "font-bold" : ""}>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-2xl border-2 border-amber-line bg-amber-soft p-4 font-bold text-amber-ink">{a.notAdvice}</p>
    </div>
  );
}
