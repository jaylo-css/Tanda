"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { useLang } from "@/components/LangProvider";
import { useSession } from "@/components/SessionProvider";
import { ReadingStatus } from "@/components/ReadingStatus";
import { SAMPLES, type SamplePrescription } from "@/lib/samples";
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
  const router = useRouter();
  const { s: session, runExtraction, startManual } = useSession();
  const lastSample = useRef<SamplePrescription | null>(null);
  const busy = session.status === "preparing" || session.status === "reading";

  /** Runs the FULL flow on a sample: the real image goes to the AI route; Demo mode catches failures. */
  async function runSample(sample: SamplePrescription) {
    lastSample.current = sample;
    const blob = await (await fetch(sample.image)).blob();
    if (await runExtraction(new File([blob], `${sample.id}.png`, { type: "image/png" }), { raw: true })) {
      router.push("/review");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand">{s.title}</h1>
        <p>{s.intro}</p>
        <p className="rounded-2xl border-2 border-line bg-card p-3 text-base text-muted">{s.statusNote}</p>
        <p className="text-base font-bold">{s.useNote}</p>
        <ReadingStatus
          onRetry={() => { if (lastSample.current) void runSample(lastSample.current); }}
          onManual={() => {
            startManual();
            router.push("/review");
          }}
        />
      </header>

      <section aria-labelledby="box-sample" className="space-y-3 rounded-2xl border-2 border-line bg-card p-4">
        <h2 id="box-sample" className="text-2xl font-bold">{s.boxTitle}</h2>
        <p>{s.boxText}</p>
        <Image src="/samples/box-amlodipine-10mg.png" alt={s.boxAlt} width={800} height={600} className="w-full max-w-sm rounded-xl border-2 border-line" />
        <a href="/samples/box-amlodipine-10mg.png" download className="btn btn-secondary">{s.boxSave}</a>
      </section>

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
          <button type="button" className="btn btn-primary btn-xl" disabled={busy} onClick={() => void runSample(sample)}>
            {s.use}
          </button>
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
            <span className="font-bold">{labels.original}:</span> {med.sig_raw || "â€”"}
          </p>
          <p className="mt-1 text-lg">
            <span className="font-bold">{labels.tagalog}:</span> {lang === "tl" ? parsed.tagalog : parsed.english}
          </p>
          {lowFields.length > 0 && (
            <p className="mt-2 text-base font-bold">
              âš  {labels.lowConfidence}: {lowFields.join(", ")}
            </p>
          )}
          {parsed.flags.map((f) => (
            <p key={f.code + (f.detail ?? "")} className="mt-1 text-base font-bold">
              âš  {labels.needsConfirm}: {lang === "tl" ? f.tl : f.en}
            </p>
          ))}
          {!amber && <p className="mt-1 text-base font-bold text-brand">âœ“ {labels.ok}</p>}
        </>
      )}
    </li>
  );
}
