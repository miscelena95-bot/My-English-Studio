"use client";

import { useEffect, useState } from "react";
import { saveVoicePreference } from "@/app/actions/profile";
import { getRecognitionCtor, speak, speechSynthesisSupported, useVoices } from "@/lib/client/speech";
import { Button, Notice } from "@/components/ui";

export function VoiceSettings({ voiceName, rate }: { voiceName: string | null; rate: number }) {
  const voices = useVoices();
  const [caps, setCaps] = useState<{ stt: boolean; tts: boolean } | null>(null);
  const [voice, setVoice] = useState(voiceName ?? "");
  const [r, setR] = useState(rate);
  const [saved, setSaved] = useState(false);
  const [mic, setMic] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaps({ stt: !!getRecognitionCtor(), tts: speechSynthesisSupported() });
  }, []);

  async function testMic() {
    setMic("Requesting microphone permission…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("Microphone access granted. Voice input is ready.");
    } catch {
      setMic("Microphone access was denied or no microphone was found. Allow it in your browser's site settings.");
    }
  }

  if (!caps) return <p className="small muted">Checking your browser…</p>;
  return (
    <div className="stack">
      <ul className="list small">
        <li className="row-between"><span>Speech-to-text (your voice → text)</span><strong>{caps.stt ? "Supported in this browser" : "Not supported in this browser"}</strong></li>
        <li className="row-between"><span>Text-to-speech (tutor's voice)</span><strong>{caps.tts ? `Supported · ${voices.length} English voices` : "Not supported"}</strong></li>
      </ul>
      {!caps.stt && <Notice tone="warning">Speech recognition isn&apos;t available here (e.g. Firefox). Use Chrome, Edge or Safari for voice conversations — text mode always works.</Notice>}
      {caps.stt && (
        <div className="row">
          <Button size="small" onClick={testMic}>Test microphone permission</Button>
          {mic && <span className="small" role="status">{mic}</span>}
        </div>
      )}
      {caps.tts && voices.length > 0 && (
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="voice">Tutor voice</label>
            <select id="voice" className="select" value={voice} onChange={(e) => { setVoice(e.target.value); setSaved(false); }}>
              <option value="">Automatic (British English if available)</option>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="rate">Speaking speed: {r.toFixed(2)}×</label>
            <input id="rate" type="range" className="range" min={0.7} max={1.2} step={0.05} value={r} onChange={(e) => { setR(Number(e.target.value)); setSaved(false); }} />
          </div>
        </div>
      )}
      {caps.tts && (
        <div className="row">
          <Button size="small" onClick={() => speak("Hello! This is how your tutor will sound. Shall we practise a little today?", { voiceName: voice || null, rate: r })}>Play a sample</Button>
          <Button size="small" variant="primary" onClick={async () => { const res = await saveVoicePreference(voice || null, r); setSaved(res.ok); }}>Save voice</Button>
          {saved && <span className="small" role="status">Saved.</span>}
        </div>
      )}
      <p className="tiny muted">
        Privacy: in Chrome and Edge, speech recognition is processed by the browser vendor&apos;s online service (Google or Microsoft); in Safari, by Apple. My English Studio never records or stores audio — only the text transcript you send.
      </p>
    </div>
  );
}
