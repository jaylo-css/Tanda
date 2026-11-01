"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getStrings, type Lang, type Strings } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Strings;
}

const LangContext = createContext<LangContextValue | null>(null);
const STORAGE_KEY = "tanda.lang";

/*
 * Tagalog is the default; English is a toggle. The choice is remembered on this
 * device only. A tiny external store keeps server and first client render identical
 * (both "tl"), then switches to the saved choice without a hydration mismatch.
 */
let memoryLang: Lang | null = null; // used if browser storage is blocked
const listeners = new Set<() => void>();

function readStored(): Lang {
  if (memoryLang) return memoryLang;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "tl" || saved === "en") return saved;
  } catch {
    /* storage can be blocked (private window); the app works without it */
  }
  return "tl";
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore<Lang>(subscribe, readStored, () => "tl");

  useEffect(() => {
    document.documentElement.lang = lang === "tl" ? "fil" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    memoryLang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<LangContextValue>(() => ({ lang, setLang, t: getStrings(lang) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}
