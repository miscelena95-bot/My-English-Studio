"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addResource, completeResourceActivity, deleteResource, generateActivityForResource } from "@/app/actions/content";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { wordCount } from "@/lib/domain/text";
import { Button, Notice } from "@/components/ui";
import { SaveExpressionButton } from "@/components/vocab/VocabButtons";
import { ProductionFeedbackView } from "@/components/feedback/ProductionFeedbackView";
import type { ContentActivity, ProductionFeedback } from "@/lib/ai/schemas";

export function AddResourceForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const r = await addResource({ title: fd.get("title"), url: fd.get("url"), kind: fd.get("kind"), notes: fd.get("notes") });
        if (r.ok) {
          (e.target as HTMLFormElement).reset();
          router.push(`/real-english/resources/${r.data}`);
        } else setMsg({ ok: false, text: r.error });
      }}
    >
      {msg && <Notice tone={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      <div className="grid-2">
        <div className="field"><label className="label" htmlFor="r-title">Title *</label><input id="r-title" name="title" className="input" required minLength={3} maxLength={200} /></div>
        <div className="field"><label className="label" htmlFor="r-kind">Type</label><select id="r-kind" name="kind" className="select"><option value="article">Article</option><option value="video">Video</option><option value="podcast">Podcast</option><option value="book">Book</option><option value="song">Song</option><option value="other">Other</option></select></div>
      </div>
      <div className="field"><label className="label" htmlFor="r-url">Link</label><input id="r-url" name="url" className="input" type="url" placeholder="https://…" /></div>
      <div className="field">
        <label className="label" htmlFor="r-notes">Paste a short extract, or write your own summary/notes</label>
        <textarea id="r-notes" name="notes" className="textarea" maxLength={4000} />
        <span className="help">The tutor builds questions only from what you provide here — it doesn&apos;t browse the link. Keep extracts short and for personal study.</span>
      </div>
      <div><Button type="submit" variant="primary">Add resource</Button></div>
    </form>
  );
}

export function GenerateActivity({ id, aiConfigured }: { id: number; aiConfigured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  if (!aiConfigured) return <Notice tone="warning">Building activities from your own resources needs the AI tutor (not configured). You can still use the notes and write a response below.</Notice>;
  return (
    <div className="stack-s">
      <div><Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); setErr(null); const r = await generateActivityForResource(id); setBusy(false); if (r.ok) router.refresh(); else setErr(r.error); }}>{busy ? <><span className="spinner" /> Building your activity…</> : "Build a learning activity"}</Button></div>
      {err && <Notice tone="error">{err}</Notice>}
    </div>
  );
}

export function GeneratedActivityView({ id, activity, aiConfigured }: { id: number; activity: ContentActivity | null; aiConfigured: boolean }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ used: string[]; feedback: ProductionFeedback | null } | null>(null);
  const seconds = useActiveTimer();
  return (
    <div className="stack-l">
      {activity && (
        <>
          <div className="card stack-s"><div className="card-title">Summary (written by the tutor from your source)</div><p className="mb-0">{activity.summary}</p></div>
          <div className="card stack-s">
            <div className="card-title">Key expressions</div>
            <ul className="list">{activity.keyExpressions.map((k) => <li key={k.phrase} className="row-between"><span><span className="phrase">{k.phrase}</span> <span className="small muted">— {k.meaning}</span></span><SaveExpressionButton phrase={k.phrase} definition={k.meaning} source="real-english" sourceRef={`resource:${id}`} /></li>)}</ul>
          </div>
          <div className="card stack">
            <div className="card-title">Comprehension</div>
            {activity.comprehensionQuestions.map((q, i) => (
              <div key={q.question} className="stack-s">
                <strong>{i + 1}. {q.question}</strong>
                <div className="options">
                  {q.options.map((o, k) => {
                    const chosen = answers[i];
                    const state = chosen === undefined ? undefined : k === q.answerIndex ? "correct" : chosen === k ? "wrong" : undefined;
                    return <button key={o} type="button" className="option" data-state={state} disabled={chosen !== undefined} onClick={() => setAnswers((a) => ({ ...a, [i]: k }))}><span className="option-key">{String.fromCharCode(65 + k)}</span>{o}</button>;
                  })}
                </div>
                {answers[i] !== undefined && <p className="small muted mb-0">{q.explanation}</p>}
              </div>
            ))}
          </div>
          <div className="card stack-s"><div className="card-title">Discuss</div><ol className="mb-0">{activity.discussionQuestions.map((q) => <li key={q}>{q}</li>)}</ol></div>
        </>
      )}
      <div className="card stack">
        <div className="card-title">Your response</div>
        <p className="mb-0">{activity?.productionTask ?? "Summarise the content in your own words and give your opinion."}</p>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your response" />
        <div className="row">
          <Button onClick={async () => { setBusy(true); const r = await completeResourceActivity(id, text, seconds(), false); setBusy(false); if (r.ok) setResult(r.data); else setErr(r.error); }} disabled={busy || wordCount(text) < 15}>Save</Button>
          {aiConfigured && <Button variant="primary" onClick={async () => { setBusy(true); const r = await completeResourceActivity(id, text, seconds(), true); setBusy(false); if (r.ok) setResult(r.data); else setErr(r.error); }} disabled={busy || wordCount(text) < 15}>{busy ? <span className="spinner" /> : "Save with feedback"}</Button>}
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        {result && <><Notice tone="success">Saved.{result.used.length ? ` You used: ${result.used.join(", ")}.` : ""}</Notice>{result.feedback && <ProductionFeedbackView fb={result.feedback} />}</>}
      </div>
    </div>
  );
}

export function DeleteResource({ id }: { id: number }) {
  const router = useRouter();
  return <Button size="small" variant="danger" onClick={async () => { if (confirm("Remove this resource?")) { await deleteResource(id); router.push("/real-english"); } }}>Remove</Button>;
}
