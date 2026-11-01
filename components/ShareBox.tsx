"use client";

import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";
import { useSession } from "./SessionProvider";
import { fmt } from "@/lib/i18n";
import { formatDate, type PrescriptionData } from "@/lib/prescription";
import { toSharePayload } from "@/lib/shareSchema";

type Step = "idle" | "confirm" | "making" | "error" | "rate";

/** "Ibahagi sa pamilya": asks first (privacy), then makes the link and a QR code. Only shown if Supabase is set up. */
export function ShareBox({ data }: { data: PrescriptionData }) {
  const { lang, t } = useLang();
  const a = t.actions;
  const { s, setShare } = useSession();
  const [step, setStep] = useState<Step>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function make() {
    setStep("making");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toSharePayload(data)),
        signal: AbortSignal.timeout(40_000),
      });
      if (res.status === 429) return setStep("rate");
      const json = await res.json();
      if (!json.ok) return setStep("error");
      const url = `${window.location.origin}/s/${json.id}`;
      setShare({ url, expiresAt: json.expiresAt });
      setStep("idle");
    } catch {
      setStep("error");
    }
  }

  // QR code: made in the browser from the link, nothing is sent anywhere
  const shareUrl = s.share?.url ?? null;
  useEffect(() => {
    if (!shareUrl) return;
    let alive = true;
    import("qrcode")
      .then((Q) => Q.toDataURL(shareUrl, { width: 260, margin: 1, errorCorrectionLevel: "M" }))
      .then((dataUrl) => alive && setQr(dataUrl))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [shareUrl]);

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard can be blocked; the link is selectable in the box */
    }
  }

  if (s.share) {
    return (
      <section aria-labelledby="share-ready" className="space-y-3 rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <h2 id="share-ready" className="text-2xl font-bold text-brand-dark">{a.shareReady}</h2>
        <label htmlFor="share-link" className="block text-base font-bold">{a.shareLink}</label>
        <input id="share-link" readOnly value={s.share.url} onFocus={(e) => e.currentTarget.select()} className="w-full min-h-12 rounded-lg border-2 border-line bg-white px-3 py-2 text-lg" />
        <button type="button" className="btn btn-primary w-full" onClick={copy}>{copied ? `✓ ${a.copied}` : a.copy}</button>
        <p role="status" className="sr-only">{copied ? a.copied : ""}</p>
        {qr && (
          <div className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made in the browser */}
            <img src={qr} alt={a.qrAlt} width={260} height={260} className="rounded-lg border-2 border-line bg-white" />
            <p className="text-base">{a.qrHint}</p>
          </div>
        )}
        <p className="text-base font-bold">{fmt(a.expires, { date: formatDate(s.share.expiresAt, lang) })}</p>
      </section>
    );
  }

  if (step === "idle") {
    return (
      <button type="button" className="btn btn-secondary w-full" onClick={() => setStep("confirm")}>
        <span aria-hidden="true">🔗</span> {a.share}
      </button>
    );
  }

  return (
    <section aria-labelledby="share-h" className="space-y-3 rounded-2xl border-2 border-amber-line bg-amber-soft p-4 text-amber-ink">
      <h2 id="share-h" className="text-xl font-bold">{a.shareTitle}</h2>
      <p>{a.shareNotice}</p>
      {step === "making" && <p role="status" className="font-bold">{a.sharing}</p>}
      {step === "error" && <p role="alert" className="font-bold text-danger">{a.shareFail}</p>}
      {step === "rate" && <p role="alert" className="font-bold text-danger">{a.shareRate}</p>}
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <button type="button" className="btn btn-primary flex-1" disabled={step === "making"} onClick={make}>{a.shareCreate}</button>
        <button type="button" className="btn btn-secondary flex-1" disabled={step === "making"} onClick={() => setStep("idle")}>{a.shareCancel}</button>
      </div>
    </section>
  );
}
