"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { useSession, type Role } from "@/components/SessionProvider";
import { MedicineCard } from "@/components/review/MedicineCard";
import { BoxPhoto } from "@/components/review/BoxPhoto";
import { inputClass } from "@/components/review/Field";
import { buildBoxCheck } from "@/lib/boxmatch";
import { fmt } from "@/lib/i18n";
import { canFinalize, setPhoto } from "@/lib/review";

export default function ReviewPage() {
  const { t } = useLang();
  const r = t.review;
  const router = useRouter();
  const { s, setHeader, setReviewer, updateEntry, addBlank, removeEntry, finalize, reset } = useSession();

  if (s.entries.length === 0 && !s.source) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold text-brand">{r.title}</h1>
        <p>{r.empty}</p>
        <Link href="/upload" className="btn btn-primary btn-xl">{r.goUpload}</Link>
      </div>
    );
  }

  const gate = canFinalize(s.entries);
  const pendingTotal = gate.pendingFields;

  function onFinal() {
    finalize();
    router.push("/result");
  }

  return (
    <div className="space-y-6 pb-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand">{r.title}</h1>
        <p>{r.intro}</p>
        {(() => {
          const backup = s.source === "ai" && s.provider !== null && s.provider !== "gemini";
          const warn = s.source === "demo" || backup;
          return (
            <p role={backup ? "alert" : undefined} className={`rounded-xl border-2 p-3 text-base font-bold ${warn ? "border-amber-line bg-amber-soft text-amber-ink" : "border-line bg-card"}`}>
              {s.source === "demo" ? r.sourceDemo : s.source === "manual" ? r.sourceManual : backup ? r.sourceBackup : r.sourceAi}
            </p>
          );
        })()}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* original photo, next to the list on wide screens */}
        <aside className="lg:sticky lg:top-4 lg:self-start" aria-label={r.photoTitle}>
          <details open className="rounded-2xl border-2 border-line bg-card p-3">
            <summary className="min-h-12 cursor-pointer py-2 text-xl font-bold">{r.photoTitle}</summary>
            {s.imageUrl ? (
              <a href={s.imageUrl} target="_blank" rel="noopener" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the user's own device */}
                <img src={s.imageUrl} alt={r.photoAlt} className="max-h-[70vh] w-full rounded-lg border-2 border-line object-contain" />
                <span className="mt-2 block text-base font-bold text-brand underline">{r.photoOpen}</span>
              </a>
            ) : (
              <p className="text-base text-muted">{r.photoNone}</p>
            )}
          </details>
        </aside>

        <div className="space-y-6">
          <section aria-labelledby="hdr" className="space-y-3 rounded-2xl border-2 border-line bg-card p-3 sm:p-4">
            <h2 id="hdr" className="text-xl font-bold">{r.headerTitle}</h2>
            <HeaderInput id="h-patient" label={r.patient} value={s.header.patient.name} onChange={(v) => setHeader((h) => ({ ...h, patient: { ...h.patient, name: v } }))} />
            <HeaderInput id="h-age" label={r.age} value={s.header.patient.age} onChange={(v) => setHeader((h) => ({ ...h, patient: { ...h.patient, age: v } }))} />
            <HeaderInput id="h-doctor" label={r.doctor} value={s.header.doctor.name} onChange={(v) => setHeader((h) => ({ ...h, doctor: { ...h.doctor, name: v } }))} />
            <HeaderInput id="h-clinic" label={r.clinic} value={s.header.doctor.clinic} onChange={(v) => setHeader((h) => ({ ...h, doctor: { ...h.doctor, clinic: v } }))} />
            <HeaderInput id="h-date" label={r.date} value={s.header.date} onChange={(v) => setHeader((h) => ({ ...h, date: v }))} />
            {s.unreadableNotes.length > 0 && (
              <div className="rounded-xl border-2 border-amber-line bg-amber-soft p-3 text-amber-ink">
                <p className="font-bold">⚠ {r.unreadableNotes}</p>
                <ul className="list-disc pl-6">{s.unreadableNotes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            )}
          </section>

          <section aria-labelledby="who" className="space-y-3 rounded-2xl border-2 border-line bg-card p-3 sm:p-4">
            <h2 id="who" className="text-xl font-bold">{r.reviewerTitle}</h2>
            <HeaderInput id="r-name" label={t.upload.reviewerName} value={s.reviewer.name} onChange={(v) => setReviewer({ name: v })} autoComplete="name" />
            <div>
              <label htmlFor="r-role" className="mb-1 block text-base font-bold">{t.upload.roleLabel}</label>
              <select id="r-role" className={inputClass} value={s.reviewer.role} onChange={(e) => setReviewer({ role: e.target.value as Role })}>
                {(Object.keys(t.upload.roles) as Role[]).map((k) => <option key={k || "none"} value={k}>{t.upload.roles[k]}</option>)}
              </select>
            </div>
          </section>

          {s.entries.length === 0 && <p className="font-bold">{r.noMedicines}</p>}
          <ol className="space-y-5">
            {s.entries.map((e, i) => (
              <MedicineCard
                key={e.id}
                entry={e}
                index={i}
                onChange={(fn) => updateEntry(e.id, fn)}
                onRemove={() => removeEntry(e.id)}
                extra={
                  <BoxPhoto
                    entry={e}
                    index={i}
                    entries={s.entries}
                    onChange={(fn) => updateEntry(e.id, fn)}
                    onMove={(toId, label) => {
                      const photo = e.photo;
                      if (!photo) return;
                      updateEntry(e.id, (x) => setPhoto(x, null));
                      // the box check is recomputed against the line that receives the photo
                      updateEntry(toId, (x) => setPhoto(x, { dataUrl: photo.dataUrl, box: buildBoxCheck(label, x, true) }));
                    }}
                  />
                }
              />
            ))}
          </ol>

          <button type="button" className="btn btn-secondary btn-xl" onClick={addBlank}>{r.add}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { reset(); router.push("/upload"); }}>{r.startOver}</button>
        </div>
      </div>

      {/* always-visible bar: progress + the gated Final button */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t-2 border-brand bg-white px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-3xl space-y-1">
          <p className="text-base font-bold leading-snug" role="status" aria-live="polite">
            {fmt(r.progress, { done: gate.confirmedLines, total: gate.total })}
            {pendingTotal > 0 && <span className="text-amber-ink"> · {fmt(r.pending, { n: pendingTotal })}</span>}
          </p>
          <button type="button" className="btn btn-primary min-h-14 w-full text-lg" disabled={!gate.ok} aria-describedby="final-help" onClick={onFinal}>
            {r.finalBtn}
          </button>
          <p id="final-help" className="sr-only">{gate.ok ? "" : r.finalBlocked}</p>
        </div>
      </div>
    </div>
  );
}

function HeaderInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-bold">{label}</label>
      <input id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete ?? "off"} />
    </div>
  );
}
