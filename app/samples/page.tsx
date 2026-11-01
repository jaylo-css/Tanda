"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useLang } from "@/components/LangProvider";
import { SAMPLES } from "@/lib/samples";
import { parseSig } from "@/lib/sig";
import { CONFIDENCE_THRESHOLD, type ExtractedMedicine } from "@/lib/schema";
import { UNREADABLE_TL, UNREADABLE_EN } from "@/lib/sig";

/**
 * Preview of Step 3: the deterministic sig parser run over the synthetic samples.
 * The "from the image" values are the pre-saved sample reads (no AI is called here).
 */
export default function SamplesPage() {
  const { lang, t } = useLang();
  const s = t.samples;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand">{s.title}</h1>
        <p>{s.intro}</p>
        <p className="rounded-2xl border-2 border-line bg-card p-3 text-base text-muted">{s.statusNote}</p>
      </header>

      {SAMPLES.map((sample) => (
        <section key={sample.id} aria-labelledby={sample.id} className="space-y-4">
          <h2 id={sample.id} className="text-2xl font-bold">
            {lang === "tl" ? sample.titleTl : sample.titleEn}
          </h2>
          <p>{lang === "tl" ? sample.descriptionTl : sample.descriptionEn}</p>
          <Image
            src={sample.image}
            alt={`${lang === "tl" ? "Sample na reseta (gawa-gawa lang)" : "Sample prescription (synthetic)"}: ${
              lang === "tl" ? sample.titleTl : sample.titleEn
            }`}
            width={900}
            height={1200}
            className="w-full max-w-sm rounded-xl border-2 border-line"
          />
          <ul className="space-y-3">
            {sample.extracted.medicines.map((m, i) => (
              <MedicineRow key={i} med={m} lang={lang} labels={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MedicineRow({
  med,
  lang,
  labels,
}: {
  med: ExtractedMedicine;
  lang: "tl" | "en";
  labels: ReturnType<typeof useLang>["t"]["samples"];
}) {
  const parsed = useMemo(
    () =>
      parseSig(med.sig_raw, {
        dosageForm: med.dosage_form,
        ignoreWords: [med.generic_name, med.brand_name].filter(Boolean),
      }),
    [med],
  );

  const unreadableLine = !med.generic_name && !med.sig_raw;
  const lowFields = (Object.entries(med.confidence) as Array<[string, number]>)
    .filter(([, v]) => v < CONFIDENCE_THRESHOLD)
    .map(([k]) => k);
  const amber = unreadableLine || lowFields.length > 0 || parsed.needsReview;

  return (
    <li
      className={`rounded-2xl border-2 p-4 ${
        amber ? "border-amber-line bg-amber-soft text-amber-ink" : "border-line bg-card"
      }`}
    >
      {unreadableLine ? (
        <p className="text-xl font-bold">{lang === "tl" ? UNREADABLE_TL : UNREADABLE_EN}</p>
      ) : (
        <>
          <p className="text-xl font-bold">
            {med.generic_name || "?"} {med.strength}
            {med.brand_name ? <span className="text-base font-normal"> ({med.brand_name})</span> : null}
          </p>
          <p className="text-base">
            <span className="font-bold">{labels.original}:</span> {med.sig_raw || "—"}
          </p>
          <p className="mt-1 text-lg">
            <span className="font-bold">{labels.tagalog}:</span> {lang === "tl" ? parsed.tagalog : parsed.english}
          </p>
          {lowFields.length > 0 && (
            <p className="mt-2 text-base font-bold">
              ⚠ {labels.lowConfidence}: {lowFields.join(", ")}
            </p>
          )}
          {parsed.flags.map((f) => (
            <p key={f.code + (f.detail ?? "")} className="mt-1 text-base font-bold">
              ⚠ {labels.needsConfirm}: {lang === "tl" ? f.tl : f.en}
            </p>
          ))}
          {!amber && <p className="mt-1 text-base font-bold text-brand">✓ {labels.ok}</p>}
        </>
      )}
    </li>
  );
}
