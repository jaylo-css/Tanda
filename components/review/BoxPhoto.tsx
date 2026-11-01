"use client";

import { useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { BoxWarnings } from "../BoxWarnings";
import { FormIcon } from "../icons";
import { buildBoxCheck, suggestMatch } from "@/lib/boxmatch";
import { blobToDataUrl, prepareImage } from "@/lib/clientImage";
import { fmt, ICON_ONLY_LABEL } from "@/lib/i18n";
import { setPhoto, type MedicineEntry, type MedicinePhoto } from "@/lib/review";
import type { BoxLabel } from "@/lib/schema";

interface Props {
  entry: MedicineEntry;
  index: number;
  entries: MedicineEntry[];
  onChange: (fn: (e: MedicineEntry) => MedicineEntry) => void;
  /** Moves the photo (with its confirmed box check) to another prescription line. */
  onMove: (toId: string, label: BoxText) => void;
}

type BoxText = { generic_name: string; brand_name: string; strength: string };
type Suggestion = { label: BoxText; matchId: string | null };

/** The medicine photo: the user's REAL photo of the box, or a plain dosage-form icon. Never AI-made. */
export function BoxPhoto({ entry, index, entries, onChange, onMove }: Props) {
  const { lang, t } = useLang();
  const p = t.photos;
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"preparing" | "reading" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const id = `box${index}`;
  const name = entry.genericName || entry.brandName || "?";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSuggestion(null);
    setBusy("preparing");
    try {
      const blob = await prepareImage(file, 800, 600 * 1024);
      const dataUrl = await blobToDataUrl(blob);
      onChange((x) => setPhoto(x, { dataUrl }));
    } catch {
      setError(p.imgFail);
    } finally {
      setBusy(null);
    }
  }

  async function readLabel(photo: MedicinePhoto) {
    setError(null);
    setBusy("reading");
    try {
      const blob = await (await fetch(photo.dataUrl)).blob();
      const form = new FormData();
      form.append("image", blob, "box.jpg");
      const res = await fetch("/api/box", { method: "POST", body: form, signal: AbortSignal.timeout(35_000) });
      const json = await res.json();
      if (!json.ok) {
        setError(lang === "tl" ? json.tl : json.en);
        return;
      }
      const label = json.label as BoxLabel;
      const match = suggestMatch({ ...label }, entries);
      setSuggestion({ label: { generic_name: label.generic_name, brand_name: label.brand_name, strength: label.strength }, matchId: match?.id ?? null });
    } catch {
      setError(p.readFail);
    } finally {
      setBusy(null);
    }
  }

  const confirmHere = (label: Suggestion["label"]) => {
    onChange((x) => (x.photo ? setPhoto(x, { ...x.photo, box: buildBoxCheck(label, x, true) }) : x));
    setSuggestion(null);
  };

  const matched = suggestion?.matchId ? entries.find((x) => x.id === suggestion.matchId) : undefined;
  const matchedIndex = matched ? entries.findIndex((x) => x.id === matched.id) : -1;
  const sameLine = matched?.id === entry.id;

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3 rounded-xl border-2 border-line p-3">
      <h4 id={`${id}-h`} className="text-lg font-bold">{p.title}</h4>
      <p className="text-base text-muted">{p.intro}</p>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
      <input ref={gallery} type="file" accept="image/*,.heic,.heif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />

      {entry.photo ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the user's own photo as a data: URL */}
          <img src={entry.photo.dataUrl} alt={fmt(p.alt, { name })} className="h-28 w-28 shrink-0 rounded-lg border-2 border-line object-cover" />
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-secondary text-base" onClick={() => camera.current?.click()}>{p.replace}</button>
            <button type="button" className="btn btn-secondary text-base" onClick={() => { setSuggestion(null); onChange((x) => setPhoto(x, null)); }}>{p.remove}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line bg-white">
            <FormIcon form={entry.dosageForm} size={64} />
          </div>
          <p className="text-base font-bold">{ICON_ONLY_LABEL[lang]}</p>
        </div>
      )}

      {!entry.photo && (
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <button type="button" className="btn btn-primary flex-1" disabled={!!busy} onClick={() => camera.current?.click()}><span aria-hidden="true">📷</span> {p.take}</button>
          <button type="button" className="btn btn-secondary flex-1" disabled={!!busy} onClick={() => gallery.current?.click()}>{p.choose}</button>
        </div>
      )}

      {busy && <p role="status" className="text-base font-bold">{busy === "preparing" ? p.preparing : p.reading}</p>}
      {error && <p role="alert" className="text-base font-bold text-danger">{error}</p>}

      {entry.photo && !entry.photo.box && !suggestion && (
        <div className="space-y-2">
          <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={() => entry.photo && void readLabel(entry.photo)}>{p.read}</button>
          <p className="text-base text-muted">{p.readNote}</p>
        </div>
      )}

      {suggestion && (
        <div className="space-y-2 rounded-xl border-2 border-brand bg-brand-soft p-3" role="group" aria-label={p.readLabel}>
          <p className="text-base"><span className="font-bold">{p.readLabel}:</span> {[suggestion.label.generic_name, suggestion.label.brand_name && `(${suggestion.label.brand_name})`, suggestion.label.strength].filter(Boolean).join(" ") || "—"}</p>
          {!matched && <p className="text-lg font-bold">{p.suggestNone}</p>}
          {matched && sameLine && (
            <p className="text-lg font-bold">{fmt(p.suggest, { name: matched.genericName || matched.brandName, strength: matched.strength })} {p.isThis}</p>
          )}
          {matched && !sameLine && (
            <p className="text-lg font-bold">{fmt(p.suggestOther, { name: matched.genericName || matched.brandName, strength: matched.strength, n: matchedIndex + 1 })}</p>
          )}
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            {matched && sameLine && <button type="button" className="btn btn-primary flex-1" onClick={() => confirmHere(suggestion.label)}>{p.yes}</button>}
            {matched && !sameLine && <button type="button" className="btn btn-primary flex-1" onClick={() => { onMove(matched.id, suggestion.label); setSuggestion(null); }}>{fmt(p.move, { n: matchedIndex + 1 })}</button>}
            {matched && !sameLine && <button type="button" className="btn btn-secondary flex-1" onClick={() => confirmHere(suggestion.label)}>{p.keepHere}</button>}
            {!matched && <button type="button" className="btn btn-secondary flex-1" onClick={() => confirmHere(suggestion.label)}>{p.useHere}</button>}
            {matched && sameLine && <button type="button" className="btn btn-secondary flex-1" onClick={() => setSuggestion(null)}>{p.no}</button>}
            {!sameLine && <button type="button" className="btn btn-secondary flex-1" onClick={() => setSuggestion(null)}>{p.no}</button>}
          </div>
        </div>
      )}

      {entry.photo?.box && (
        <div className="space-y-2">
          <p className="text-base font-bold text-brand">✓ {p.matched}</p>
          <p className="text-base"><span className="font-bold">{p.readLabel}:</span> {[entry.photo.box.label.generic_name, entry.photo.box.label.strength].filter(Boolean).join(" ") || "—"}</p>
          <BoxWarnings warnings={entry.photo.box.warnings} />
        </div>
      )}
    </section>
  );
}
