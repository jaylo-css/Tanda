"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PrescriptionData } from "./prescription";
import { buildSpeechItems, pickVoice } from "./speech";
import type { Lang } from "./sig";

// --- browser voices as an external store (they load asynchronously) -------------------------------
let cachedVoices: SpeechSynthesisVoice[] = [];
const NO_VOICES: SpeechSynthesisVoice[] = [];

function readVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return NO_VOICES;
  const now = window.speechSynthesis.getVoices();
  const same = now.length === cachedVoices.length && now.every((v, i) => v.voiceURI === cachedVoices[i].voiceURI);
  if (!same) cachedVoices = [...now];
  return cachedVoices;
}

function subscribeVoices(cb: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => undefined;
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

const subscribeNothing = () => () => undefined;

export interface SpeechApi {
  supported: boolean;
  playing: boolean;
  currentId: string | null;
  /** The UI language is Tagalog but this device has no Filipino voice. */
  noFilipinoVoice: boolean;
  /** Reading Tagalog text with an English voice (the person's choice). */
  tagalogWithEnglishVoice: boolean;
  setTagalogWithEnglishVoice: (v: boolean) => void;
  playAll: () => void;
  playOne: (id: string) => void;
  stop: () => void;
}

/** Reads the confirmed prescription aloud, one medicine at a time. */
export function useSpeech(data: PrescriptionData, lang: Lang): SpeechApi {
  const supported = useSyncExternalStore(subscribeNothing, () => typeof window !== "undefined" && "speechSynthesis" in window, () => false);
  const voices = useSyncExternalStore(subscribeVoices, readVoices, () => NO_VOICES);
  const [playing, setPlaying] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tagalogWithEnglishVoice, setTagalogWithEnglishVoice] = useState(false);
  const run = useRef(0); // lets a new play/stop cancel an older queue

  const pick = useMemo(() => pickVoice(voices, lang), [voices, lang]);
  const noFilipinoVoice = lang === "tl" && !pick.filipino;
  // No Filipino voice: read the ENGLISH version (clear to the English voice), unless the person chose otherwise.
  const speakLang: Lang = noFilipinoVoice && !tagalogWithEnglishVoice ? "en" : lang;
  const voice = useMemo(() => pickVoice(voices, speakLang).voice, [voices, speakLang]);

  const stop = useCallback(() => {
    run.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentId(null);
  }, []);

  const speak = useCallback(
    (onlyId?: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      const mine = ++run.current;
      synth.cancel();
      let items = buildSpeechItems(data, speakLang);
      if (onlyId) items = items.filter((i) => i.id === onlyId);
      if (items.length === 0) return;
      setPlaying(true);
      const next = (i: number) => {
        if (run.current !== mine) return; // stopped or replaced
        if (i >= items.length) {
          setPlaying(false);
          setCurrentId(null);
          return;
        }
        const u = new SpeechSynthesisUtterance(items[i].text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? (speakLang === "tl" ? "fil-PH" : "en-US");
        u.rate = 0.9; // a little slower for older listeners
        setCurrentId(items[i].id);
        u.onend = () => next(i + 1);
        u.onerror = () => next(i + 1);
        synth.speak(u);
      };
      next(0);
    },
    [data, speakLang, voice],
  );

  useEffect(() => () => {
    run.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return {
    supported,
    playing,
    currentId,
    noFilipinoVoice,
    tagalogWithEnglishVoice,
    setTagalogWithEnglishVoice,
    playAll: () => speak(),
    playOne: (id) => speak(id),
    stop,
  };
}
