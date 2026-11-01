"use client";

import type { ReactNode } from "react";
import { useLang } from "./LangProvider";
import { BoxWarnings } from "./BoxWarnings";
import { FormIcon, PillCount, SlotIcon, TimingIcon } from "./icons";
import { DISCLAIMER, fmt, ICON_ONLY_LABEL } from "@/lib/i18n";
import { formatDate, type PrescriptionData } from "@/lib/prescription";
import type { DisplayMedicine } from "@/lib/review";
import { buildSchedule } from "@/lib/schedule";
import { SLOT_LABEL, UNREADABLE_EN, UNREADABLE_TL, type Lang } from "@/lib/sig";

interface Props {
  data: PrescriptionData;
  /** Share page: the day the link stops working. */
  expiresAt?: string;
  /** Buttons / extra controls placed under the header (read aloud, print, share). */
  actions?: ReactNode;
  /** Index of the medicine being read aloud right now (highlighted). */
  speakingId?: string | null;
}

const TIMING_TEXT: Record<Lang, Record<string, string>> = {
  tl: { AC: "Bago kumain", PC: "Pagkatapos kumain", WITH_MEALS: "Kasabay ng pagkain", EMPTY_STOMACH: "Sa walang laman na tiyan" },
  en: { AC: "Before meals", PC: "After meals", WITH_MEALS: "With meals", EMPTY_STOMACH: "On an empty stomach" },
};

/**
 * The clear, large-print Tagalog prescription. Used by /result (with actions), the printable
 * card and the family share page (/s/[id]), so all three always look and read the same.
 * Body text is at least 18px; every icon sits next to a word.
 */
export function PrescriptionView({ data, expiresAt, actions, speakingId }: Props) {
  const { lang, t } = useLang();
  const r = t.result;
  const schedule = buildSchedule(data.medicines);
  const checker = data.reviewerName
    ? fmt(r.checkedBy, { name: data.reviewerName + (data.reviewerRole ? ` (${t.upload.roles[data.reviewerRole]})` : "") })
    : r.checkedByAnon;

  return (
    <div className="print-area space-y-6">
      <header className="avoid-break space-y-3 rounded-2xl border-2 border-ink bg-white p-4">
        <h1 className="text-4xl font-bold leading-tight text-brand">{r.title}</h1>
        <dl className="grid gap-x-6 gap-y-1 text-xl sm:grid-cols-2">
          <Row label={r.patient} value={data.patientName + (data.patientAge ? `, ${r.age} ${data.patientAge}` : "")} strong notWritten={r.notWritten} />
          <Row label={r.doctor} value={data.doctorName + (data.clinic ? ` · ${data.clinic}` : "")} notWritten={r.notWritten} />
          <Row label={r.date} value={data.prescriptionDate} notWritten={r.notWritten} />
        </dl>
        <p className="text-lg">
          <span className="font-bold">{checker}</span> {fmt(r.checkedOn, { date: formatDate(data.checkedAt, lang) })}
        </p>
        {expiresAt && (
          <p className="text-lg font-bold text-amber-ink">
            {lang === "tl" ? `Mawawala ang link na ito sa ${formatDate(expiresAt, "tl")}.` : `This link stops working on ${formatDate(expiresAt, "en")}.`}
          </p>
        )}
        <Disclaimer />
        {actions && <div className="no-print">{actions}</div>}
      </header>

      <ol className="space-y-4" aria-label={r.medicines}>
        {data.medicines.map((m, i) => (
          <MedicineCard key={m.id} m={m} index={i} lang={lang} speaking={speakingId === m.id} />
        ))}
      </ol>

      <section className="avoid-break rounded-2xl border-2 border-ink bg-white p-4" aria-labelledby="schedule-h">
        <h2 id="schedule-h" className="mb-3 text-3xl font-bold">{r.scheduleTitle}</h2>
        {/* table-fixed + wrapping cells: fits a 375px phone without sideways scrolling */}
        <table className="w-full table-fixed border-collapse text-xl">
          <thead>
            <tr className="bg-brand-soft text-left">
              <th scope="col" className="w-[34%] border-2 border-ink p-2">{r.time}</th>
              <th scope="col" className="border-2 border-ink p-2">{r.medicines}</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row) => (
              <tr key={row.slot} className="align-top">
                <th scope="row" className="border-2 border-ink p-2 text-left">
                  <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"><SlotIcon slot={row.slot} size={40} /><span className="break-words">{SLOT_LABEL[lang][row.slot]}</span></span>
                </th>
                <td className="border-2 border-ink p-2">
                  {row.items.length === 0 ? (
                    <span aria-label="—">—</span>
                  ) : (
                    <ul className="space-y-3">
                      {row.items.map((m) => (
                        <li key={m.id} className="flex items-start gap-2">
                          <Thumb m={m} size={36} />
                          <span className="min-w-0 flex-1 break-words">
                            <span className="font-bold">{m.name ?? (lang === "tl" ? UNREADABLE_TL : UNREADABLE_EN)}</span>{" "}
                            <span className="whitespace-nowrap">{m.strength}</span>
                            {(lang === "tl" ? m.doseTl : m.doseEn) && <span className="block">{lang === "tl" ? m.doseTl : m.doseEn}</span>}
                          </span>
                          <span className="hidden sm:inline-flex"><PillCount amount={m.amount} size={28} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {schedule.prn.length > 0 && (
          <div className="mt-4">
            <h3 className="text-2xl font-bold">{r.prnTitle}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-xl">
              {schedule.prn.map((m) => (
                <li key={m.id}><span className="font-bold">{m.name ?? (lang === "tl" ? UNREADABLE_TL : UNREADABLE_EN)}</span> {m.strength}: {lang === "tl" ? m.tagalog : m.english}</li>
              ))}
            </ul>
          </div>
        )}
        {schedule.other.length > 0 && (
          <div className="mt-4">
            <h3 className="text-2xl font-bold">{r.otherTitle}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-xl">
              {schedule.other.map((m) => (
                <li key={m.id}><span className="font-bold">{m.name ?? (lang === "tl" ? UNREADABLE_TL : UNREADABLE_EN)}</span> {m.strength}: {lang === "tl" ? m.tagalog : m.english}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <footer className="avoid-break space-y-2 rounded-2xl border-2 border-ink bg-white p-4 text-lg">
        <Disclaimer />
        <p><span className="font-bold">{checker}</span> {fmt(r.checkedOn, { date: formatDate(data.checkedAt, lang) })}</p>
      </footer>
    </div>
  );
}

function Disclaimer() {
  const { lang } = useLang();
  return <p className="rounded-xl border-2 border-ink bg-amber-soft p-3 text-xl font-bold text-ink">{DISCLAIMER[lang]}</p>;
}

function Row({ label, value, strong, notWritten }: { label: string; value: string; strong?: boolean; notWritten: string }) {
  return (
    <div>
      <dt className="text-base font-bold text-muted">{label}</dt>
      <dd className={strong ? "text-2xl font-bold" : ""}>{value.trim() ? value : <span className="text-muted">{notWritten}</span>}</dd>
    </div>
  );
}

/** The user's real photo, or a plain form icon. */
function Thumb({ m, size }: { m: DisplayMedicine; size: number }) {
  const { t } = useLang();
  if (m.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- the user's own photo (data: or signed URL)
    return <img src={m.photoUrl} alt={`${t.result.photoOf}: ${m.name ?? ""}`} width={size} height={size} className="shrink-0 rounded-md border-2 border-ink object-cover" style={{ width: size, height: size }} />;
  }
  return <span className="shrink-0"><FormIcon form={m.form} size={size} /></span>;
}

function MedicineCard({ m, index, lang, speaking }: { m: DisplayMedicine; index: number; lang: Lang; speaking: boolean }) {
  const { t } = useLang();
  const r = t.result;
  const unreadable = m.name === null;
  const sentence = lang === "tl" ? m.tagalog : m.english;
  const dose = lang === "tl" ? m.doseTl : m.doseEn;
  return (
    <li
      data-med-id={m.id}
      className={`avoid-break space-y-3 rounded-2xl border-2 bg-white p-4 ${speaking ? "border-brand outline outline-4 outline-brand" : "border-ink"}`}
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          {m.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the user's own photo
            <img src={m.photoUrl} alt={`${r.photoOf}: ${m.name ?? ""}`} className="h-24 w-24 rounded-xl border-2 border-ink object-cover sm:h-32 sm:w-32" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-ink bg-brand-soft sm:h-32 sm:w-32">
              <FormIcon form={m.form} size={72} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-muted">#{index + 1}</p>
          <h2 className="break-words text-2xl font-bold leading-tight sm:text-3xl">{unreadable ? (lang === "tl" ? UNREADABLE_TL : UNREADABLE_EN) : m.name}</h2>
          {m.brand && <p className="text-lg">({m.brand})</p>}
          {m.strength && <p className="text-2xl font-bold">{m.strength}</p>}
        </div>
      </div>
      {!m.photoUrl && <p className="text-base font-bold text-muted">{ICON_ONLY_LABEL[lang]}</p>}

      <p className="text-2xl leading-snug">{sentence}</p>

      <ul className="flex flex-wrap gap-x-5 gap-y-3 text-xl" aria-label={t.review.slots}>
        {m.slots.map((s) => (
          <li key={s} className="flex items-center gap-2"><SlotIcon slot={s} size={44} /><span className="font-bold">{SLOT_LABEL[lang][s]}</span></li>
        ))}
        {m.timing && (
          <li className="flex items-center gap-2"><TimingIcon kind={m.timing} size={44} /><span className="font-bold">{TIMING_TEXT[lang][m.timing]}</span></li>
        )}
        {(dose || m.amount) && (
          <li className="flex items-center gap-2"><PillCount amount={m.amount} size={36} />{dose && <span className="font-bold">{dose}</span>}</li>
        )}
      </ul>

      {m.paraSaan && (
        <p className="text-xl"><span className="font-bold">{r.forWhat}:</span> {m.paraSaan}</p>
      )}
      <BoxWarnings warnings={m.boxWarnings} large />
    </li>
  );
}
