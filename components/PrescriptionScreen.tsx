"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "./LangProvider";
import { PrescriptionView } from "./PrescriptionView";
import { ShareBox } from "./ShareBox";
import type { PrescriptionData } from "@/lib/prescription";
import { useSpeech } from "@/lib/useSpeech";

/** Does this deployment have Supabase (share links)? The server answers; no key ever reaches the browser. */
function useSharingEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((j) => alive && setOn(j.sharing === true))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return on;
}

interface Props {
  data: PrescriptionData;
  expiresAt?: string;
  /** Offer "Ibahagi sa pamilya" (only on the owner's result page, and only if Supabase is configured). */
  allowShare?: boolean;
  /** Extra buttons, e.g. "go back and change". */
  extra?: ReactNode;
}

/** The confirmed prescription with Listen / Print / Share. Used by /result and by the family page /s/[id]. */
export function PrescriptionScreen({ data, expiresAt, allowShare, extra }: Props) {
  const { lang, t } = useLang();
  const speech = useSpeech(data, lang);
  const sharingOn = useSharingEnabled();
  const a = t.actions;

  return (
    <div className="space-y-4">
      <PrescriptionView
        data={data}
        expiresAt={expiresAt}
        speakingId={speech.currentId}
        onSpeak={speech.supported ? speech.playOne : undefined}
        actions={
          <div className="space-y-3">
            <div className="grid gap-3 min-[420px]:grid-cols-2">
              {speech.playing ? (
                <button type="button" className="btn btn-primary" onClick={speech.stop} aria-live="polite">
                  <span aria-hidden="true">⏹</span> {a.stop}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={!speech.supported} onClick={speech.playAll}>
                  <span aria-hidden="true">🔊</span> {a.listen}
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <span aria-hidden="true">🖨</span> {a.print}
              </button>
            </div>
            <p className="text-base text-muted">{a.printHint}</p>
            {speech.playing && <p role="status" className="text-base font-bold text-brand">{a.reading}</p>}
            {!speech.supported && <p className="text-base font-bold text-amber-ink">{a.noSpeech}</p>}
            {speech.supported && speech.noFilipinoVoice && (
              <div className="space-y-2 rounded-xl border-2 border-amber-line bg-amber-soft p-3 text-amber-ink">
                <p className="font-bold">{a.noFilipinoVoice}</p>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                  <input type="checkbox" className="h-6 w-6 accent-[#0b5d4b]" checked={speech.tagalogWithEnglishVoice} onChange={(e) => speech.setTagalogWithEnglishVoice(e.target.checked)} />
                  {a.readTagalogAnyway}
                </label>
              </div>
            )}
            {allowShare && sharingOn && <ShareBox data={data} />}
            {extra}
          </div>
        }
      />
    </div>
  );
}
