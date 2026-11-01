"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { useSession, type Role } from "@/components/SessionProvider";
import { ReadingStatus } from "@/components/ReadingStatus";
import { inputClass } from "@/components/review/Field";

export default function UploadPage() {
  const { t } = useLang();
  const u = t.upload;
  const router = useRouter();
  const { s, runExtraction, startManual, setConsent, setReviewer } = useSession();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  const busy = s.status === "preparing" || s.status === "reading";

  async function process(file: File) {
    if (!s.consent) return; // the buttons are disabled too; this is the real guard
    lastFile.current = file;
    if (await runExtraction(file)) router.push("/review");
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same photo again
    if (file) void process(file);
  }

  function manual() {
    startManual();
    router.push("/review");
  }

  const accept = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif";
  const blocked = !s.consent || busy;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand">{u.title}</h1>
        <p>{u.intro}</p>
      </header>

      <section aria-labelledby="privacy" className="space-y-3 rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <h2 id="privacy" className="text-xl font-bold text-brand-dark">{u.consentTitle}</h2>
        <ul className="list-disc space-y-2 pl-6">
          {u.consent.map((line, i) => (
            <li key={line} className={i === 2 ? "font-bold" : ""}>{line}</li>
          ))}
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-brand bg-white p-3 text-lg font-bold text-ink">
          <input
            type="checkbox"
            className="mt-1 h-7 w-7 shrink-0 accent-[#0b5d4b]"
            checked={s.consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{u.consentCheck}</span>
        </label>
      </section>

      <section aria-labelledby="who" className="space-y-3">
        <h2 id="who" className="text-xl font-bold">{u.reviewerTitle}</h2>
        <div>
          <label htmlFor="reviewer-name" className="mb-1 block text-base font-bold">{u.reviewerName}</label>
          <input id="reviewer-name" className={inputClass} value={s.reviewer.name} autoComplete="name"
            onChange={(e) => setReviewer({ name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="reviewer-role" className="mb-1 block text-base font-bold">{u.roleLabel}</label>
          <select id="reviewer-role" className={inputClass} value={s.reviewer.role}
            onChange={(e) => setReviewer({ role: e.target.value as Role })}>
            {(Object.keys(u.roles) as Role[]).map((k) => (
              <option key={k || "none"} value={k}>{u.roles[k]}</option>
            ))}
          </select>
        </div>
      </section>

      <section aria-label={u.title} className="space-y-3">
        <input ref={cameraRef} type="file" accept={accept} capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
        <input ref={galleryRef} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />

        <button type="button" className="btn btn-primary btn-xl" disabled={blocked} aria-describedby="upload-help" onClick={() => cameraRef.current?.click()}>
          <span aria-hidden="true">ðŸ“·</span> {u.camera}
        </button>
        <button type="button" className="btn btn-secondary btn-xl" disabled={blocked} aria-describedby="upload-help" onClick={() => galleryRef.current?.click()}>
          <span aria-hidden="true">ðŸ–¼ï¸</span> {u.gallery}
        </button>
        <p id="upload-help" className={`text-base ${s.consent ? "text-muted" : "font-bold text-amber-ink"}`}>
          {s.consent ? u.accepted : u.mustConsent}
        </p>

        <ReadingStatus onRetry={() => { if (lastFile.current) void process(lastFile.current); }} onManual={manual} />

        {!busy && s.status !== "error" && (
          <button type="button" className="btn btn-secondary btn-xl" onClick={manual}>
            âŒ¨ï¸ {u.manual}
          </button>
        )}
      </section>

      <p className="text-base">
        {u.noPrescription}{" "}
        <Link href="/samples" className="font-bold text-brand underline">{u.seeSamples}</Link>
      </p>
    </div>
  );
}
