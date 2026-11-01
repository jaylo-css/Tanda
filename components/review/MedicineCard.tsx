"use client";

import { useState, type ReactNode } from "react";
import { useLang } from "../LangProvider";
import { Field, inputClass } from "./Field";
import { fmt } from "@/lib/i18n";
import {
  canConfirmLine,
  computeAmberKeys,
  confirmField,
  confirmLine,
  editDuration,
  editForm,
  editParaSaan,
  editSigRaw,
  editSlots,
  editTagalogOverride,
  editText,
  editTiming,
  pendingAmber,
  toDisplay,
  unconfirmLine,
  type AmberKey,
  type MedicineEntry,
} from "@/lib/review";
import { CONFIDENCE_THRESHOLD, DOSAGE_FORMS, type DosageForm } from "@/lib/schema";
import { SLOT_IDS, SLOT_LABEL, type DurationKind, type SigFlag, type SlotId, type TimingKind } from "@/lib/sig";

interface Props {
  entry: MedicineEntry;
  index: number;
  onChange: (fn: (e: MedicineEntry) => MedicineEntry) => void;
  onRemove: () => void;
  /** Extra sections (e.g. the medicine photo in Milestone 3). */
  extra?: ReactNode;
}

const TIMINGS: Array<"none" | TimingKind> = ["none", "AC", "PC", "WITH_MEALS", "EMPTY_STOMACH"];
const DURATIONS: Array<"none" | DurationKind> = ["none", "days", "weeks", "months", "maintenance", "until_finished"];

export function MedicineCard({ entry, index, onChange, onRemove, extra }: Props) {
  const { lang, t } = useLang();
  const r = t.review;
  const [editingTagalog, setEditingTagalog] = useState(!!entry.tagalogOverride);
  const amber = computeAmberKeys(entry);
  const pending = pendingAmber(entry);
  const isAmber = (k: AmberKey) => amber.includes(k);
  const isDone = (k: AmberKey) => !!entry.confirmed[k];
  const confirm = (k: AmberKey) => onChange((e) => confirmField(e, k));
  const display = toDisplay(entry);
  const id = `m${index}`;

  const flagsFor = (pred: (f: SigFlag) => boolean) =>
    entry.sig.flags.filter(pred).map((f) => (
      <p key={f.code + (f.detail ?? "")} className="mt-2 text-base font-bold">
        ⚠ {lang === "tl" ? f.tl : f.en}
      </p>
    ));

  const timingValue: "none" | TimingKind = entry.sig.timing?.kind ?? "none";
  const durKind: "none" | DurationKind = entry.sig.duration?.kind ?? "none";
  const durNeedsNumber = durKind === "days" || durKind === "weeks" || durKind === "months";

  return (
    <li
      className={`space-y-3 rounded-2xl border-2 p-3 sm:p-4 ${
        entry.lineConfirmed ? "border-brand bg-brand-soft" : pending.length ? "border-amber-line bg-white" : "border-line bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xl font-bold">
          {fmt(r.medicineN, { n: index + 1 })}
          {entry.lineConfirmed && <span className="ml-2 text-base text-brand">✓ {r.lineConfirmed}</span>}
        </h3>
        <button type="button" onClick={onRemove} className="btn btn-secondary text-base" aria-label={`${r.removeLine} ${index + 1}`}>
          {t.common.remove}
        </button>
      </div>

      <Field id={`${id}-name`} label={r.name} amber={isAmber("name")} confirmed={isDone("name")} onConfirm={() => confirm("name")}
        notes={entry.confidence.generic_name < CONFIDENCE_THRESHOLD && entry.genericName ? <p className="mt-2 text-base font-bold">⚠ {r.lowConf}</p> : null}>
        <input id={`${id}-name`} className={inputClass} value={entry.genericName} onChange={(e) => onChange((x) => editText(x, "genericName", e.target.value))} autoComplete="off" />
      </Field>

      <div>
        <label htmlFor={`${id}-brand`} className="mb-1 block text-base font-bold">{r.brand}</label>
        <input id={`${id}-brand`} className={inputClass} value={entry.brandName} onChange={(e) => onChange((x) => editText(x, "brandName", e.target.value))} autoComplete="off" />
      </div>

      <Field id={`${id}-strength`} label={r.strength} amber={isAmber("strength")} confirmed={isDone("strength")} onConfirm={() => confirm("strength")}
        notes={entry.confidence.strength < CONFIDENCE_THRESHOLD && entry.strength ? <p className="mt-2 text-base font-bold">⚠ {r.lowConf}</p> : null}>
        <input id={`${id}-strength`} className={inputClass} value={entry.strength} onChange={(e) => onChange((x) => editText(x, "strength", e.target.value))} autoComplete="off" />
      </Field>

      <div>
        <label htmlFor={`${id}-form`} className="mb-1 block text-base font-bold">{r.form}</label>
        <select id={`${id}-form`} className={inputClass} value={entry.dosageForm} onChange={(e) => onChange((x) => editForm(x, e.target.value as DosageForm))}>
          {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{r.forms[f]}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-written`} className="mb-1 block text-base font-bold">{r.written}</label>
        <p className="mb-1 text-base text-muted">{r.writtenHint}</p>
        <input id={`${id}-written`} className={`${inputClass} font-mono`} value={entry.sigRaw} onChange={(e) => onChange((x) => editSigRaw(x, e.target.value))} autoComplete="off" spellCheck={false} placeholder="1 tab BID pc x 7 days" />
      </div>

      <Field
        id={`${id}-tagalog`}
        group
        label={r.instructions}
        amber={isAmber("instructions")}
        confirmed={isDone("instructions")}
        onConfirm={() => confirm("instructions")}
        notes={
          <>
            {entry.confidence.sig_raw < CONFIDENCE_THRESHOLD && entry.sigRaw ? <p className="mt-2 text-base font-bold">⚠ {r.lowConf}</p> : null}
            {flagsFor((f) => f.field !== "slots")}
          </>
        }
      >
        <p id={`${id}-tagalog`} className="rounded-lg bg-white/70 p-2 text-xl font-bold text-ink">
          {lang === "tl" ? display.tagalog : display.english}
        </p>
        <details className="mt-2" open={editingTagalog} onToggle={(e) => setEditingTagalog((e.target as HTMLDetailsElement).open)}>
          <summary className="min-h-12 cursor-pointer py-2 text-base font-bold underline">{r.editTagalog}</summary>
          <p className="mb-1 text-base">{r.tagalogNote}</p>
          <textarea
            aria-label={r.editTagalog}
            className={`${inputClass} text-ink`}
            rows={3}
            value={entry.tagalogOverride ?? ""}
            placeholder={entry.sig.tagalog}
            onChange={(e) => onChange((x) => editTagalogOverride(x, e.target.value))}
          />
          {entry.tagalogOverride && (
            <button type="button" className="btn btn-secondary mt-2" onClick={() => onChange((x) => editTagalogOverride(x, ""))}>
              {r.restoreGenerated}
            </button>
          )}
        </details>
      </Field>

      <Field
        id={`${id}-slots`}
        group
        label={r.slots}
        amber={isAmber("slots")}
        confirmed={isDone("slots")}
        onConfirm={() => confirm("slots")}
        notes={flagsFor((f) => f.field === "slots")}
      >
        <div role="group" aria-labelledby={`${id}-slots-label`} className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {SLOT_IDS.map((slot: SlotId) => {
            const checked = entry.sig.slots.includes(slot);
            return (
              <label key={slot} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 text-lg ${checked ? "border-brand bg-brand-soft font-bold text-ink" : "border-line bg-white text-ink"}`}>
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[#0b5d4b]"
                  checked={checked}
                  onChange={() => onChange((x) => editSlots(x, checked ? x.sig.slots.filter((s) => s !== slot) : [...x.sig.slots, slot]))}
                />
                {SLOT_LABEL[lang][slot]}
              </label>
            );
          })}
        </div>
      </Field>

      <details className="rounded-xl border-2 border-line p-3">
        <summary className="min-h-12 cursor-pointer py-2 text-base font-bold">{r.more}</summary>
        <div className="space-y-3 pt-2">
          <div>
            <label htmlFor={`${id}-timing`} className="mb-1 block text-base font-bold">{r.timing}</label>
            <select id={`${id}-timing`} className={inputClass} value={timingValue}
              onChange={(e) => onChange((x) => editTiming(x, e.target.value === "none" ? null : { kind: e.target.value as TimingKind }))}>
              {TIMINGS.map((k) => <option key={k} value={k}>{r.timings[k]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-dur`} className="mb-1 block text-base font-bold">{r.duration}</label>
            <div className="flex gap-2">
              <select id={`${id}-dur`} className={inputClass} value={durKind}
                onChange={(e) => {
                  const k = e.target.value as "none" | DurationKind;
                  onChange((x) => editDuration(x, k === "none" ? null : k === "days" || k === "weeks" || k === "months" ? { kind: k, value: x.sig.duration?.value ?? 7 } : { kind: k }));
                }}>
                {DURATIONS.map((k) => <option key={k} value={k}>{r.durations[k]}</option>)}
              </select>
              {durNeedsNumber && (
                <input aria-label={r.durationValue} type="number" min={1} max={365} inputMode="numeric" className={`${inputClass} max-w-28`}
                  value={entry.sig.duration?.value ?? ""}
                  onChange={(e) => onChange((x) => editDuration(x, { kind: x.sig.duration?.kind as "days" | "weeks" | "months", value: Math.max(1, Math.min(365, Number(e.target.value) || 1)) }))} />
              )}
            </div>
          </div>
        </div>
      </details>

      <div>
        <label htmlFor={`${id}-para`} className="mb-1 block text-base font-bold">{r.paraSaan}</label>
        <p className="mb-1 text-base text-muted">{r.paraSaanHint}</p>
        <input id={`${id}-para`} className={inputClass} value={entry.paraSaan} onChange={(e) => onChange((x) => editParaSaan(x, e.target.value))} autoComplete="off" />
        {entry.sig.indicationRaw && !entry.paraSaan && (
          <button type="button" className="btn btn-secondary mt-2 text-base" onClick={() => onChange((x) => editParaSaan(x, x.sig.indicationRaw ?? ""))}>
            {fmt(r.useWritten, { text: entry.sig.indicationRaw })}
          </button>
        )}
      </div>

      {extra}

      <div className="border-t-2 border-line pt-3">
        {entry.lineConfirmed ? (
          <button type="button" className="btn btn-secondary btn-xl" onClick={() => onChange(unconfirmLine)}>
            ✓ {r.lineConfirmed} · {r.lineEdit}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-xl" disabled={!canConfirmLine(entry)} onClick={() => onChange(confirmLine)}>
              {r.lineConfirm}
            </button>
            {!canConfirmLine(entry) && <p className="mt-2 text-base font-bold text-amber-ink">{r.lineBlocked}</p>}
          </>
        )}
      </div>
    </li>
  );
}
