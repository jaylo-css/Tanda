"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { useSession } from "@/components/SessionProvider";
import { toDisplay } from "@/lib/review";

/** Temporary summary: the full large-print page, icons and schedule table arrive in Milestone 3. */
export default function ResultPage() {
  const { lang } = useLang();
  const { s } = useSession();

  if (!s.finalizedAt) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p>{lang === "tl" ? "Wala pang napapatunayang reseta." : "No confirmed prescription yet."}</p>
        <Link href="/review" className="btn btn-primary btn-xl">{lang === "tl" ? "Bumalik sa pagsusuri" : "Back to review"}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold text-brand">{lang === "tl" ? "Ang Iyong Gamot" : "Your Medicines"}</h1>
      <ul className="space-y-3">
        {s.entries.map((e) => {
          const d = toDisplay(e);
          return (
            <li key={d.id} className="rounded-2xl border-2 border-line bg-card p-4">
              <p className="text-2xl font-bold">{d.name ?? (lang === "tl" ? "Hindi mabasa, itanong sa pharmacist o doktor" : "Can't read this, ask your pharmacist or doctor")} {d.strength}</p>
              <p className="text-xl">{lang === "tl" ? d.tagalog : d.english}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
