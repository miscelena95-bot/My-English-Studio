"use client";

import { useEffect, useState } from "react";
import { speak, speechSynthesisSupported, stopSpeaking } from "@/lib/client/speech";
import { Button } from "@/components/ui";
import { IconStop, IconVolume } from "@/components/ui/icons";

/** Reads a text aloud with the browser's built-in voice (a computer voice, clearly labelled). */
export function ListenButton({ text, voiceName, rate }: { text: string; voiceName?: string | null; rate?: number }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOk(speechSynthesisSupported());
    return () => stopSpeaking();
  }, []);
  if (ok === null) return null;
  if (!ok) return <span className="small muted">Read-aloud isn&apos;t supported in this browser.</span>;
  return (
    <span className="row">
      <Button size="small" onClick={() => { if (playing) { stopSpeaking(); setPlaying(false); } else speak(text, { voiceName, rate, onStart: () => setPlaying(true), onEnd: () => setPlaying(false) }); }}>
        {playing ? <><IconStop size={14} /> Stop</> : <><IconVolume size={14} /> Listen</>}
      </Button>
      <span className="tiny muted">Computer voice from your browser</span>
    </span>
  );
}
