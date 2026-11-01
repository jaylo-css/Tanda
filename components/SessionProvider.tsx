"use client";

/**
 * In-memory state for one prescription (photo, reviewer, header, medicine lines).
 * Deliberately NOT saved to localStorage/sessionStorage/IndexedDB: prescription photos and
 * patient details leave the device only if the user chooses to share. Closing the tab clears it.
 */

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from "react";
import { blobToDataUrl, ImageError, prepareImage } from "@/lib/clientImage";
import {
  blankEntry,
  canFinalize,
  entryFromExtracted,
  type MedicineEntry,
} from "@/lib/review";
import type { ExtractedPrescription } from "@/lib/schema";

export type Role = "" | "pasyente" | "kapamilya" | "pharmacist";
export type Source = "ai" | "demo" | "manual";
export type Status = "idle" | "preparing" | "reading" | "error";

export interface SessionError {
  code: string;
  tl: string;
  en: string;
}

export interface Header {
  doctor: { name: string; clinic: string; license_no: string };
  patient: { name: string; age: string };
  date: string;
}

export interface ShareInfo {
  url: string;
  /** ISO time the link stops working (30 days after it was made). */
  expiresAt: string;
}

export interface Session {
  status: Status;
  error: SessionError | null;
  imageUrl: string | null;
  source: Source | null;
  provider: string | null;
  sampleId: string | null;
  consent: boolean;
  reviewer: { name: string; role: Role };
  header: Header;
  entries: MedicineEntry[];
  unreadableNotes: string[];
  /** ISO time the human finalised the clear version; null = still in review. */
  finalizedAt: string | null;
  /** Set when a share link was made for the finalised version. */
  share: ShareInfo | null;
}

const emptyHeader: Header = {
  doctor: { name: "", clinic: "", license_no: "" },
  patient: { name: "", age: "" },
  date: "",
};

const initial: Session = {
  status: "idle",
  error: null,
  imageUrl: null,
  source: null,
  provider: null,
  sampleId: null,
  consent: false,
  reviewer: { name: "", role: "" },
  header: emptyHeader,
  entries: [],
  unreadableNotes: [],
  finalizedAt: null,
  share: null,
};

type Action =
  | { type: "reset" }
  | { type: "status"; status: Status; error?: SessionError | null }
  | { type: "loaded"; data: ExtractedPrescription; source: Source; provider: string | null; sampleId: string | null; imageUrl: string | null }
  | { type: "consent"; value: boolean }
  | { type: "reviewer"; patch: Partial<Session["reviewer"]> }
  | { type: "header"; fn: (h: Header) => Header }
  | { type: "update"; id: string; fn: (e: MedicineEntry) => MedicineEntry }
  | { type: "add" }
  | { type: "remove"; id: string }
  | { type: "finalize" }
  | { type: "reopen" }
  | { type: "share"; share: ShareInfo | null };

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m${Math.random().toString(36).slice(2)}`;

function reducer(s: Session, a: Action): Session {
  switch (a.type) {
    case "reset":
      // keep consent and reviewer within the same visit: asking again would be tiresome
      return { ...initial, consent: s.consent, reviewer: s.reviewer };
    case "status":
      return { ...s, status: a.status, error: a.error ?? null };
    case "loaded":
      return {
        ...s,
        status: "idle",
        error: null,
        source: a.source,
        provider: a.provider,
        sampleId: a.sampleId,
        imageUrl: a.imageUrl,
        header: {
          doctor: { ...a.data.doctor },
          patient: { ...a.data.patient },
          date: a.data.date,
        },
        entries: a.data.medicines.map((m) => entryFromExtracted(m, newId())),
        unreadableNotes: a.data.unreadable_notes,
        finalizedAt: null,
        share: null,
      };
    case "consent":
      return { ...s, consent: a.value };
    case "reviewer":
      return { ...s, reviewer: { ...s.reviewer, ...a.patch } };
    case "header":
      return { ...s, header: a.fn(s.header) };
    case "update":
      return { ...s, entries: s.entries.map((e) => (e.id === a.id ? a.fn(e) : e)), finalizedAt: null, share: null };
    case "add":
      return { ...s, entries: [...s.entries, blankEntry(newId())], finalizedAt: null, share: null };
    case "remove":
      return { ...s, entries: s.entries.filter((e) => e.id !== a.id), finalizedAt: null, share: null };
    case "finalize":
      // the gate is enforced here too, not just by a disabled button
      return canFinalize(s.entries).ok ? { ...s, finalizedAt: new Date().toISOString() } : s;
    case "reopen":
      return { ...s, finalizedAt: null, share: null };
    case "share":
      return { ...s, share: a.share };
  }
}

interface SessionApi {
  s: Session;
  /** Prepares (resizes) and reads a prescription image. Resolves true when there is something to review. */
  runExtraction: (file: Blob & { name?: string }, opts?: { raw?: boolean }) => Promise<boolean>;
  startManual: () => void;
  reset: () => void;
  setConsent: (v: boolean) => void;
  setReviewer: (patch: Partial<Session["reviewer"]>) => void;
  setHeader: (fn: (h: Header) => Header) => void;
  updateEntry: (id: string, fn: (e: MedicineEntry) => MedicineEntry) => void;
  addBlank: () => void;
  removeEntry: (id: string) => void;
  finalize: () => void;
  reopen: () => void;
  setShare: (share: ShareInfo | null) => void;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const objectUrl = useRef<string | null>(null);

  const swapImageUrl = (next: string | null) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = next;
  };

  const runExtraction = useCallback<SessionApi["runExtraction"]>(async (file, opts) => {
    dispatch({ type: "status", status: "preparing" });
    let blob: Blob = file;
    try {
      // sample images are sent untouched: they are already small, and the server recognises them by their exact bytes
      if (!opts?.raw) blob = await prepareImage(file);
    } catch (e) {
      const heic = e instanceof ImageError && e.kind === "heic";
      dispatch({
        type: "status",
        status: "error",
        error: {
          code: heic ? "heic" : "decode",
          tl: heic ? "Hindi mabuksan ang HEIC na litrato. Subukang kumuha ng JPG o mag-screenshot." : "Hindi mabuksan ang litrato. Subukan ang ibang litrato.",
          en: heic ? "The HEIC photo could not be opened. Try a JPG or take a screenshot." : "The photo could not be opened. Try another photo.",
        },
      });
      return false;
    }

    dispatch({ type: "status", status: "reading" });
    try {
      const form = new FormData();
      form.append("image", blob, "prescription." + (blob.type === "image/png" ? "png" : "jpg"));
      const res = await fetch("/api/extract", { method: "POST", body: form, signal: AbortSignal.timeout(40_000) });
      const json = await res.json();
      if (!json.ok) {
        dispatch({ type: "status", status: "error", error: { code: json.code ?? "ai_failed", tl: json.tl, en: json.en } });
        return false;
      }
      const url = URL.createObjectURL(blob);
      swapImageUrl(url);
      dispatch({ type: "loaded", data: json.data, source: json.source, provider: json.provider ?? null, sampleId: json.sampleId ?? null, imageUrl: url });
      return true;
    } catch {
      dispatch({
        type: "status",
        status: "error",
        error: {
          code: "network",
          tl: "Hindi maabot ang serbisyo. Tingnan ang koneksyon at subukan ulit.",
          en: "Could not reach the service. Check your connection and try again.",
        },
      });
      return false;
    }
  }, []);

  const startManual = useCallback(() => {
    swapImageUrl(null);
    dispatch({
      type: "loaded",
      data: { doctor: { name: "", clinic: "", license_no: "" }, patient: { name: "", age: "" }, date: "", medicines: [], unreadable_notes: [] },
      source: "manual",
      provider: null,
      sampleId: null,
      imageUrl: null,
    });
    dispatch({ type: "add" });
  }, []);

  const reset = useCallback(() => {
    swapImageUrl(null);
    dispatch({ type: "reset" });
  }, []);

  const api = useMemo<SessionApi>(
    () => ({
      s,
      runExtraction,
      startManual,
      reset,
      setConsent: (value) => dispatch({ type: "consent", value }),
      setReviewer: (patch) => dispatch({ type: "reviewer", patch }),
      setHeader: (fn) => dispatch({ type: "header", fn }),
      updateEntry: (id, fn) => dispatch({ type: "update", id, fn }),
      addBlank: () => dispatch({ type: "add" }),
      removeEntry: (id) => dispatch({ type: "remove", id }),
      finalize: () => dispatch({ type: "finalize" }),
      reopen: () => dispatch({ type: "reopen" }),
      setShare: (share) => dispatch({ type: "share", share }),
    }),
    [s, runExtraction, startManual, reset],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}

export { blobToDataUrl };
