"use client";

/**
 * Voice layer, kept separate from conversation logic so the provider can be
 * replaced (e.g. by a server-side speech service) without touching features.
 *
 * Speech-to-text: the browser Web Speech API (Chrome, Edge, Safari; not Firefox).
 * Text-to-speech: speechSynthesis (all modern browsers).
 */

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the microphone for this site in your browser's address bar, then try again — or switch to typing.",
  "service-not-allowed": "Your browser's speech service isn't available on this page. You can keep going by typing.",
  "audio-capture": "No microphone was found. Check that one is connected and not used by another app.",
  network: "Speech recognition needs an internet connection in this browser, and it couldn't reach the service. Try again or type instead.",
  "no-speech": "I didn't hear anything. Check your microphone and try again.",
  "language-not-supported": "English speech recognition isn't available in this browser.",
  aborted: "",
};

export type ListenStatus = "idle" | "starting" | "listening" | "error" | "unsupported";

/** Hook wrapping the Web Speech API recognition. */
export function useSpeechRecognition(lang = "en-GB") {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const startedAt = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Detection must happen in the browser; this runs once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getRecognitionCtor());
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    setError(null);
    setFinalText("");
    setInterim("");
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => {
      startedAt.current = Date.now();
      setStatus("listening");
    };
    r.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript + " ";
        else tmp += res[0].transcript;
      }
      setFinalText(fin.trim());
      setInterim(tmp);
    };
    r.onerror = (e) => {
      const msg = RECOGNITION_ERRORS[e.error] ?? `Speech recognition error (${e.error}). You can type instead.`;
      if (msg) setError(msg);
      setStatus(e.error === "aborted" ? "idle" : "error");
    };
    r.onend = () => {
      if (startedAt.current) setDuration(Math.round((Date.now() - startedAt.current) / 1000));
      startedAt.current = null;
      setInterim("");
      setStatus((s) => (s === "error" ? s : "idle"));
    };
    rec.current = r;
    setStatus("starting");
    try {
      r.start();
    } catch {
      setStatus("error");
      setError("Couldn't start the microphone. Please try again.");
    }
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);
  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
    setError(null);
    setStatus("idle");
  }, []);

  return { supported, status, transcript: [finalText, interim].filter(Boolean).join(" "), finalText, error, start, stop, reset, duration };
}

/** Pick a good English voice, preferring the learner's saved choice, then British English. */
export function pickVoice(voices: SpeechSynthesisVoice[], preferred?: string | null) {
  if (preferred) {
    const v = voices.find((x) => x.name === preferred);
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!speechSynthesisSupported()) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

export function speak(text: string, opts: { voiceName?: string | null; rate?: number; onEnd?: () => void; onStart?: () => void } = {}): boolean {
  if (!speechSynthesisSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(synth.getVoices(), opts.voiceName);
  if (v) u.voice = v;
  u.lang = v?.lang ?? "en-GB";
  u.rate = opts.rate ?? 0.95;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  u.onstart = () => opts.onStart?.();
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
