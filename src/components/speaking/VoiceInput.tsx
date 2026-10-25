"use client";

import { useEffect } from "react";
import { useSpeechRecognition } from "@/lib/client/speech";
import { IconMic, IconStop } from "@/components/ui/icons";
import { Notice } from "@/components/ui";

/**
 * Microphone control that turns speech into text using the browser's speech
 * recognition. It only appears as a working control when the browser supports it.
 */
export function VoiceInput({ onTranscript, disabled, compact }: { onTranscript: (text: string, seconds: number) => void; disabled?: boolean; compact?: boolean }) {
  const sr = useSpeechRecognition("en-GB");

  useEffect(() => {
    if (sr.status === "idle" && sr.finalText) {
      onTranscript(sr.finalText, sr.duration);
      sr.reset();
    }
  }, [sr.status, sr.finalText, sr.duration, onTranscript, sr]);

  if (sr.supported === null) return null;
  if (!sr.supported)
    return (
      <Notice tone="warning" title="Voice input isn't available in this browser">
        Speech recognition works in Chrome, Edge and Safari (not Firefox). You can type instead — everything else works the same.
      </Notice>
    );

  const listening = sr.status === "listening" || sr.status === "starting";
  return (
    <div className={compact ? "row" : "stack-s"} style={{ alignItems: "center" }}>
      <button
        type="button"
        className="mic"
        data-state={listening ? "listening" : "idle"}
        onClick={() => (listening ? sr.stop() : sr.start())}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop recording" : "Start speaking"}
        style={compact ? { width: 48, height: 48 } : undefined}
      >
        {listening ? <IconStop size={compact ? 20 : 26} /> : <IconMic size={compact ? 20 : 26} />}
      </button>
      <div aria-live="polite" className="small" style={{ minHeight: 20, maxWidth: 560 }}>
        {sr.status === "starting" && <span className="muted">Starting the microphone…</span>}
        {sr.status === "listening" && (
          <span>
            <span className="status-dot" data-on="true" />
            Listening… {sr.transcript ? <em>{sr.transcript}</em> : <span className="muted">start speaking, then press stop.</span>}
          </span>
        )}
        {sr.status === "idle" && !compact && <span className="muted">Press the microphone, speak, then press it again to stop.</span>}
        {sr.error && <span style={{ color: "var(--danger)" }}>{sr.error}</span>}
      </div>
    </div>
  );
}
