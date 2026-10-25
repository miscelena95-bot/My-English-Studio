"use client";

import { useState } from "react";
import Link from "next/link";
import { submitGrammarTask, flagForSpeaking } from "@/app/actions/grammar";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { wordCount } from "@/lib/domain/text";
import { Button, Notice } from "@/components/ui";
import { IconCheck, IconX } from "@/components/ui/icons";
import { ProductionFeedbackView } from "@/components/feedback/ProductionFeedbackView";
import type { ProductionFeedback } from "@/lib/ai/schemas";

export function GrammarTask({ topicId, title, prompt, minWords, modelAnswer, previous, aiConfigured, scenarioHref }: { topicId: string; title: string; prompt: string; minWords: number; modelAnswer: string; previous: string | null; aiConfigured: boolean; scenarioHref?: string }) {
  const [text, setText] = useState(previous ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ checks: Array<{ label: string; found: boolean }>; feedback: ProductionFeedback | null } | null>(null);
  const [flagged, setFlagged] = useState(false);
  const seconds = useActiveTimer();

  async function submit(withFeedback: boolean) {
    setBusy(true);
    setError(null);
    const r = await submitGrammarTask(topicId, text, withFeedback, seconds());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data);
  }

  return (
    <div className="stack">
      <h3 className="mb-0">{title}</h3>
      <p className="mb-0">{prompt}</p>
      <label className="sr-only" htmlFor="task">Your response</label>
      <textarea id="task" className="textarea" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row-between">
        <span className="small muted">{wordCount(text)} words · aim for about {minWords}</span>
        <div className="row">
          <Button onClick={() => submit(false)} disabled={busy || wordCount(text) < 15}>Check my structures</Button>
          {aiConfigured && <Button variant="primary" onClick={() => submit(true)} disabled={busy || wordCount(text) < 15}>{busy ? <span className="spinner" aria-label="Working" /> : "Get tutor feedback"}</Button>}
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <div className="stack fade-in">
          <div className="card card-flat">
            <div className="card-title">Target grammar in your text</div>
            <ul className="list small">
              {result.checks.map((c) => (
                <li key={c.label} className="row">{c.found ? <IconCheck color="var(--success)" /> : <IconX color="var(--danger)" />} {c.label}{!c.found && <span className="muted"> — try to include it</span>}</li>
              ))}
            </ul>
            <p className="tiny muted mb-0">This is a simple automatic check that you attempted the structures — it doesn&apos;t judge correctness.{!aiConfigured && " AI feedback isn't configured; compare with the model answer below."}</p>
          </div>
          {result.feedback && <ProductionFeedbackView fb={result.feedback} />}
          <details className="disclosure">
            <summary className="small">Compare with a model answer</summary>
            <p className="serif" style={{ whiteSpace: "pre-wrap" }}>{modelAnswer}</p>
          </details>
          <div className="row">
            {scenarioHref && <Link className="btn btn-small" href={scenarioHref}>Now use it in a conversation</Link>}
            <Button size="small" variant="ghost" disabled={flagged} onClick={async () => { const r = await flagForSpeaking(topicId, true); if (r.ok) setFlagged(true); }}>
              I understand it but can&apos;t use it spontaneously
            </Button>
            {flagged && <span className="small" role="status">Noted — speaking practice with this structure will be recommended.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
