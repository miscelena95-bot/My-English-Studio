"use client";

import { useEffect, useRef, useState } from "react";
import { submitFluencyDrill } from "@/app/actions/speaking";
import { containsPhrase, wordCount } from "@/lib/domain/text";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { VoiceInput } from "./VoiceInput";
import { ProductionFeedbackView } from "@/components/feedback/ProductionFeedbackView";
import type { ProductionFeedback } from "@/lib/ai/schemas";

export function DrillClient({ drill, aiConfigured }: { drill: { id: string; title: string; instruction: string; prompt: string; seconds: number; keywords?: string[]; targets?: string[] }; aiConfigured: boolean }) {
  const [phase, setPhase] = useState<"ready" | "running" | "review">("ready");
  const [left, setLeft] = useState(drill.seconds);
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ words: number; used: string[]; feedback: ProductionFeedback | null } | null>(null);
  const started = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      const e = Math.round((Date.now() - started.current) / 1000);
      setElapsed(e);
      setLeft(Math.max(0, drill.seconds - e));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, drill.seconds]);

  const checks = [...(drill.keywords ?? []), ...(drill.targets ?? [])].map((k) => ({ k, ok: containsPhrase(text, k) }));

  async function save(withFeedback: boolean) {
    setBusy(true);
    setError(null);
    const r = await submitFluencyDrill({ drillId: drill.id, text, seconds: elapsed, inputMode: spoken ? "spoken" : "typed", withFeedback });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data);
  }

  return (
    <div className="stack-l">
      <Card className="stack">
        <p className="mb-0">{drill.instruction}</p>
        <p className="exercise-prompt mb-0">{drill.prompt}</p>
        {checks.length > 0 && (
          <div className="chips">
            {checks.map((c) => <Badge key={c.k} tone={c.ok ? "success" : "neutral"}>{c.ok && <IconCheck size={12} />} {c.k}</Badge>)}
          </div>
        )}
        {phase === "ready" && (
          <div className="row">
            <Button variant="primary" onClick={() => { started.current = Date.now(); setPhase("running"); }}>Start the timer ({drill.seconds}s)</Button>
            <span className="small muted">Think for a few seconds first if you like — then don&apos;t stop.</span>
          </div>
        )}
        {phase !== "ready" && (
          <div className="row-between">
            <span className="timer" aria-live="off" aria-label={`${left} seconds left`} style={{ color: left === 0 ? "var(--clay)" : undefined }}>
              0:{String(left).padStart(2, "0")}
            </span>
            {left === 0 && phase === "running" && <Badge tone="clay">Time&apos;s up — finish your sentence</Badge>}
          </div>
        )}
      </Card>

      {phase !== "ready" && (
        <Card className="stack">
          <VoiceInput onTranscript={(t) => { setText((x) => (x ? `${x} ${t}` : t)); setSpoken(true); }} />
          <label className="label" htmlFor="drill">{spoken ? "Transcript — fix recognition errors only, not your English" : "Or type as you would speak (fast, no editing)"}</label>
          <textarea id="drill" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row-between small">
            <span>{wordCount(text)} words in {elapsed}s</span>
            <span className="muted">We count words and time only — not pronunciation or hesitation.</span>
          </div>
          {phase === "running" && <div><Button onClick={() => setPhase("review")} disabled={wordCount(text) < 5}>I&apos;ve finished</Button></div>}
          {phase === "review" && !result && (
            <div className="stack-s">
              <div className="card card-flat small stack-s">
                <strong>Quick self-review</strong>
                <span>Did you keep going without stopping to translate? Did you use the keywords? Which sentence would you say differently now?</span>
              </div>
              <div className="row">
                <Button onClick={() => save(false)} disabled={busy}>Save</Button>
                {aiConfigured && <Button variant="primary" onClick={() => save(true)} disabled={busy}>{busy ? <span className="spinner" /> : "Save and get feedback"}</Button>}
              </div>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </Card>
      )}

      {result && (
        <Card className="stack">
          <Notice tone="success" title="Saved">
            {result.words} words.{result.used.length ? ` You used saved expressions: ${result.used.join(", ")}.` : ""} Repeating the same drill tomorrow is a proven way to build fluency — try to say more, faster.
          </Notice>
          {result.feedback && <ProductionFeedbackView fb={result.feedback} />}
          <div className="row">
            <Button onClick={() => { setPhase("ready"); setText(""); setResult(null); setLeft(drill.seconds); setElapsed(0); }}>Try it again</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
