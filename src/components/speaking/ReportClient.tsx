"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryReport, submitFollowUp } from "@/app/actions/speaking";
import { wordCount } from "@/lib/domain/text";
import { Button, Notice } from "@/components/ui";
import { VoiceInput } from "./VoiceInput";
import { ProductionFeedbackView } from "@/components/feedback/ProductionFeedbackView";
import type { ProductionFeedback } from "@/lib/ai/schemas";

export function RetryReport({ sessionId }: { sessionId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="stack-s">
      <Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); const r = await retryReport(sessionId); setBusy(false); if (r.ok) router.refresh(); else setError(r.error); }}>
        {busy ? <><span className="spinner" /> Writing your report…</> : "Generate the feedback report"}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function FollowUp({ sessionId, instruction, targets, done, previous, aiConfigured }: { sessionId: number; instruction: string; targets: string[]; done: boolean; previous: string | null; aiConfigured: boolean }) {
  const [text, setText] = useState(previous ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ used: string[]; feedback: ProductionFeedback | null } | null>(null);
  return (
    <div className="stack">
      <p className="mb-0"><strong>{instruction}</strong></p>
      {targets.length > 0 && <p className="small muted mb-0">Use: {targets.join(" · ")}</p>}
      <VoiceInput onTranscript={(t) => setText((x) => (x ? `${x} ${t}` : t))} compact />
      <label className="sr-only" htmlFor="followup">Your answer</label>
      <textarea id="followup" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <Button onClick={async () => { setBusy(true); setError(null); const r = await submitFollowUp(sessionId, text, false); setBusy(false); if (r.ok) setResult(r.data); else setError(r.error); }} disabled={busy || wordCount(text) < 5}>Save my answer</Button>
        {aiConfigured && <Button variant="primary" onClick={async () => { setBusy(true); setError(null); const r = await submitFollowUp(sessionId, text, true); setBusy(false); if (r.ok) setResult(r.data); else setError(r.error); }} disabled={busy || wordCount(text) < 5}>{busy ? <span className="spinner" /> : "Save and get feedback"}</Button>}
        {done && !result && <span className="small muted">You've already answered — you can try again.</span>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <div className="stack">
          <Notice tone="success">{result.used.length ? `You used: ${result.used.join(", ")}. Each use counts towards making them active vocabulary.` : "Saved. None of your saved expressions were detected — try including the target ones."}</Notice>
          {result.feedback && <ProductionFeedbackView fb={result.feedback} />}
        </div>
      )}
    </div>
  );
}
