"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { autosaveDraft, getWritingFeedback, saveSelfReview } from "@/app/actions/writing";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { wordCount } from "@/lib/domain/text";
import { Button, Notice } from "@/components/ui";

export function WritingEditor({ submissionId, initial, min, max, checklist, aiConfigured, version }: { submissionId: number; initial: string; min: number; max: number; checklist: string[]; aiConfigured: boolean; version: number }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const seconds = useActiveTimer();
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const words = wordCount(text);

  useEffect(() => {
    if (text === initial) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaved("saving");
      const r = await autosaveDraft(submissionId, text);
      setSaved(r.ok ? "saved" : "error");
    }, 1200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [text, initial, submissionId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saved === "unsaved" || saved === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  async function feedback() {
    setBusy(true);
    setError(null);
    const r = await getWritingFeedback(submissionId, text, seconds());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  async function selfReview() {
    setBusy(true);
    const r = await saveSelfReview(submissionId, text, checks, seconds());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="stack">
      <label className="label" htmlFor="draft">Draft {version}</label>
      <textarea id="draft" className="textarea textarea-writing" value={text} onChange={(e) => { setText(e.target.value); setSaved("unsaved"); }} placeholder="Start writing…" spellCheck={false} aria-describedby="draft-status" />
      <div className="row-between small" id="draft-status">
        <span style={{ color: words > 0 && (words < min || words > max) ? "var(--warning)" : undefined }}>
          {words} words · target {min}–{max}
        </span>
        <span className="muted" aria-live="polite">
          {saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : saved === "unsaved" ? "Unsaved changes" : "Couldn't save — check your connection"}
        </span>
      </div>
      <p className="tiny muted mb-0">Spell-check is turned off on purpose: notice your own spelling, then let the feedback confirm it.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!checking ? (
        <div className="row">
          {aiConfigured ? (
            <Button variant="primary" onClick={feedback} disabled={busy || words < 20}>
              {busy ? <><span className="spinner" /> Reading your text carefully…</> : "Get feedback"}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setChecking(true)} disabled={words < 20}>Review with the checklist</Button>
          )}
          {words < 20 && <span className="small muted">Write at least 20 words to get feedback.</span>}
        </div>
      ) : (
        <div className="card card-flat stack">
          <Notice tone="info" title="Self-review checklist">AI feedback isn&apos;t configured, so this is a structured self-review — it doesn&apos;t correct your text. Read your draft once for each point and tick only what&apos;s true.</Notice>
          {checklist.map((c) => (
            <label key={c} className="row small" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" checked={!!checks[c]} onChange={(e) => setChecks((x) => ({ ...x, [c]: e.target.checked }))} style={{ marginTop: 3 }} /> {c}
            </label>
          ))}
          <div className="row">
            <Button variant="primary" onClick={selfReview} disabled={busy}>Save review</Button>
            <Button variant="ghost" onClick={() => setChecking(false)}>Keep writing</Button>
          </div>
        </div>
      )}
    </div>
  );
}
