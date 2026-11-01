"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";

export default function HomePage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight text-brand">{t.home.title}</h1>
        <p className="text-lg">{t.home.body}</p>
        <div className="space-y-3 pt-2">
          <Link href="/upload" className="btn btn-primary btn-xl">
            <span aria-hidden="true">📷</span> {t.home.upload}
          </Link>
          <Link href="/samples" className="btn btn-secondary btn-xl">
            {t.home.trySample}
          </Link>
        </div>
      </section>

      <section aria-labelledby="steps-title" className="space-y-3">
        <h2 id="steps-title" className="text-2xl font-bold">
          {t.home.stepsTitle}
        </h2>
        <ol className="space-y-3">
          {t.home.steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border-2 border-line bg-card p-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-white"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <h2 className="text-xl font-bold text-brand-dark">{t.home.safetyTitle}</h2>
        <p>{t.home.safety}</p>
      </section>
    </div>
  );
}
