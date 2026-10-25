"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise, ExerciseResponse, GradeResult } from "@/lib/exercises/types";
import { checkWithTutor, reviewVocab, settleUnverified, submitExerciseAnswer } from "@/app/actions/exercises";
import { shuffle } from "@/lib/domain/text";
import { describeInterval, type Rating } from "@/lib/domain/srs";
import { Button, Notice } from "@/components/ui";
import { IconCheck, IconX } from "@/components/ui/icons";
import type { AnswerCheck } from "@/lib/ai/schemas";

export interface ExerciseOutcome {
  status: GradeResult["status"] | "self-accepted";
  isCorrect: boolean | null;
}

const TYPE_LABEL: Record<Exercise["type"], string> = {
  mcq: "Multiple choice",
  gap: "Fill the gap",
  match: "Match",
  order: "Word order",
  transform: "Transformation",
  correct: "Error correction",
  rephrase: "Rephrase",
  formality: "Change the register",
  produce: "Your own sentence",
};

function hashSeed(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
  return h || 1;
}

export function ExerciseCard({
  exercise,
  index,
  total,
  activityId,
  mistakeId,
  vocabId,
  aiConfigured,
  onDone,
}: {
  exercise: Exercise;
  index?: number;
  total?: number;
  activityId?: number | null;
  mistakeId?: number | null;
  vocabId?: number | null;
  aiConfigured: boolean;
  onDone?: (o: ExerciseOutcome) => void;
}) {
  const [text, setText] = useState(exercise.type === "correct" ? exercise.source : "");
  const [choice, setChoice] = useState<number | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [matches, setMatches] = useState<string[]>(exercise.type === "match" ? exercise.pairs.map(() => "") : []);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<"accepted" | "rejected" | null>(null);
  const [tutor, setTutor] = useState<AnswerCheck | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [nextReview, setNextReview] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const firstInput = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const tiles = useMemo(() => (exercise.type === "order" ? shuffle(exercise.words.map((w, i) => `${i}::${w}`), hashSeed(exercise.id)) : []), [exercise]);
  const rights = useMemo(() => (exercise.type === "match" ? shuffle(exercise.pairs.map((p) => p.right), hashSeed(exercise.id) + 3) : []), [exercise]);

  useEffect(() => {
    firstInput.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (result) feedbackRef.current?.focus({ preventScroll: false });
  }, [result]);

  const graded = !!result;
  const needsDecision = result?.status === "unverified" && !settled && !tutor;

  function response(): ExerciseResponse | null {
    switch (exercise.type) {
      case "mcq":
        return choice === null ? null : { kind: "choice", index: choice };
      case "match":
        return { kind: "match", rightForLeft: matches };
      case "order":
        return order.length ? { kind: "order", sequence: order.map((t) => t.split("::")[1]) } : null;
      default:
        return text.trim() ? { kind: "text", value: text } : null;
    }
  }

  async function submit(override?: ExerciseResponse) {
    const res = override ?? response();
    if (!res || busy || graded) return;
    setBusy(true);
    setError(null);
    const r = await submitExerciseAnswer({ exerciseId: exercise.id, response: res, activityId, mistakeId });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data.grade);
    setAttemptId(r.data.attemptId);
    if (r.data.grade.status !== "unverified" && !vocabId) onDone?.({ status: r.data.grade.status, isCorrect: r.data.grade.isCorrect });
  }

  async function settle(accepted: boolean) {
    if (!attemptId) return;
    setBusy(true);
    const r = await settleUnverified(attemptId, accepted, mistakeId);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSettled(accepted ? "accepted" : "rejected");
    if (!vocabId) onDone?.({ status: accepted ? "self-accepted" : "incorrect", isCorrect: accepted });
  }

  async function askTutor() {
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    const r = await checkWithTutor(attemptId, mistakeId);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setTutor(r.data);
    if (!vocabId) onDone?.({ status: r.data.verdict === "incorrect" ? "incorrect" : "correct", isCorrect: r.data.verdict !== "incorrect" });
  }

  async function continueReview() {
    if (!vocabId || !result) return;
    setBusy(true);
    const status = tutor ? (tutor.verdict === "incorrect" ? "incorrect" : "correct") : settled === "accepted" ? "close" : settled === "rejected" ? "incorrect" : result.status;
    const r = await reviewVocab({ vocabId, exerciseId: exercise.id, status, override: rating ?? undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNextReview(describeInterval(r.data.intervalDays));
    onDone?.({ status: result.status, isCorrect: status === "correct" || status === "close" });
  }

  const statusTitle = !result
    ? ""
    : tutor
      ? tutor.verdict === "correct"
        ? "The tutor says: correct"
        : tutor.verdict === "acceptable"
          ? "The tutor says: acceptable"
          : "The tutor says: not quite"
      : settled === "accepted"
        ? "Accepted as correct"
        : settled === "rejected"
          ? "Noted — added to your mistake tracker"
          : { correct: "Correct", close: "Almost there", incorrect: "Not quite", unverified: "Compare your answer" }[result.status];
  const feedbackStatus = tutor ? (tutor.verdict === "incorrect" ? "incorrect" : "correct") : settled === "accepted" ? "correct" : settled === "rejected" ? "incorrect" : result?.status;

  return (
    <div className="exercise fade-in" data-testid="exercise">
      <div className="exercise-head">
        <span>{TYPE_LABEL[exercise.type]}</span>
        {total ? (
          <span>
            {(index ?? 0) + 1} / {total}
          </span>
        ) : null}
      </div>
      {exercise.instruction && <p className="small muted mb-0" style={{ marginBottom: 8 }}>{exercise.instruction}</p>}
      {exercise.context && <div className="exercise-context">{exercise.context}</div>}

      {exercise.type === "mcq" && (
        <>
          <p className="exercise-prompt">{exercise.prompt}</p>
          <div className="options" role="radiogroup" aria-label="Options">
            {exercise.options.map((o, i) => {
              const correctIdx = Array.isArray(exercise.answer) ? exercise.answer : [exercise.answer];
              const state = graded ? (correctIdx.includes(i) ? "correct" : choice === i ? "wrong" : undefined) : choice === i ? "selected" : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={choice === i}
                  className="option"
                  data-state={state}
                  disabled={graded || busy}
                  onClick={() => {
                    setChoice(i);
                    void submit({ kind: "choice", index: i });
                  }}
                >
                  <span className="option-key">{String.fromCharCode(65 + i)}</span>
                  <span>{o}</span>
                  {state === "correct" && <IconCheck style={{ marginLeft: "auto" }} />}
                  {state === "wrong" && <IconX style={{ marginLeft: "auto" }} />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {exercise.type === "gap" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="exercise-prompt">
            {exercise.text.split("___")[0]}
            <label className="sr-only" htmlFor={`gap-${exercise.id}`}>
              Your answer
            </label>
            <input
              id={`gap-${exercise.id}`}
              ref={firstInput}
              className="input gap-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={graded}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              size={Math.max(10, (exercise.answers[0]?.length ?? 8) + 2)}
            />
            {exercise.text.split("___")[1]}
            {exercise.root && (
              <strong className="badge badge-clay" style={{ marginLeft: 8 }}>
                {exercise.root}
              </strong>
            )}
          </p>
          {!graded && (
            <div className="row">
              <Button type="submit" variant="primary" disabled={!text.trim() || busy}>
                Check
              </Button>
              {exercise.hint && (
                <Button variant="ghost" onClick={() => setShowHint(true)} disabled={showHint}>
                  Hint
                </Button>
              )}
              {showHint && <span className="small muted">{exercise.hint}</span>}
            </div>
          )}
        </form>
      )}

      {exercise.type === "match" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="exercise-prompt">{exercise.prompt}</p>
          <div className="match-grid">
            {exercise.pairs.map((p, i) => (
              <div className="match-row" key={p.left}>
                <label htmlFor={`m-${exercise.id}-${i}`}>
                  <strong>{p.left}</strong>
                </label>
                <select
                  id={`m-${exercise.id}-${i}`}
                  className="select"
                  value={matches[i]}
                  disabled={graded}
                  onChange={(e) => setMatches((m) => m.map((x, j) => (j === i ? e.target.value : x)))}
                >
                  <option value="">Choose…</option>
                  {rights.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">{result?.pairResults ? result.pairResults[i] ? <IconCheck color="var(--success)" /> : <IconX color="var(--danger)" /> : null}</span>
              </div>
            ))}
          </div>
          {!graded && (
            <div className="row" style={{ marginTop: 16 }}>
              <Button type="submit" variant="primary" disabled={matches.some((m) => !m) || busy}>
                Check
              </Button>
            </div>
          )}
        </form>
      )}

      {exercise.type === "order" && (
        <div>
          <p className="small muted">Click the words in order. Click a word in your sentence to remove it.</p>
          <div className="answer-line" aria-label="Your sentence" aria-live="polite">
            {order.map((t) => (
              <button key={t} type="button" className="word-tile" disabled={graded} onClick={() => setOrder((o) => o.filter((x) => x !== t))}>
                {t.split("::")[1]}
              </button>
            ))}
          </div>
          <div className="word-bank" aria-label="Words">
            {tiles
              .filter((t) => !order.includes(t))
              .map((t) => (
                <button key={t} type="button" className="word-tile" disabled={graded} onClick={() => setOrder((o) => [...o, t])}>
                  {t.split("::")[1]}
                </button>
              ))}
          </div>
          {!graded && (
            <div className="row" style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => void submit()} disabled={order.length !== tiles.length || busy}>
                Check
              </Button>
              <Button variant="ghost" onClick={() => setOrder([])} disabled={!order.length}>
                Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {(exercise.type === "transform" || exercise.type === "correct" || exercise.type === "rephrase" || exercise.type === "formality" || exercise.type === "produce") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="exercise-prompt">{exercise.prompt}</p>
          {"source" in exercise && <blockquote className="quote">{exercise.source}</blockquote>}
          {"keyword" in exercise && exercise.keyword && (
            <p className="small">
              Use: <strong className="badge badge-accent">{exercise.keyword}</strong>
            </p>
          )}
          <label className="sr-only" htmlFor={`t-${exercise.id}`}>
            Your answer
          </label>
          <textarea
            id={`t-${exercise.id}`}
            ref={firstInput}
            className="textarea"
            style={{ minHeight: exercise.type === "produce" ? 110 : 80 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={graded}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
          />
          {!graded && (
            <div className="row" style={{ marginTop: 12 }}>
              <Button type="submit" variant="primary" disabled={!text.trim() || busy}>
                {busy ? <span className="spinner" aria-label="Checking" /> : "Check"}
              </Button>
              <span className="kbd-hint">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
              </span>
            </div>
          )}
        </form>
      )}

      {error && (
        <div style={{ marginTop: 12 }}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {result && (
        <div className="feedback" data-status={feedbackStatus} ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite">
          <div className="feedback-title">{statusTitle}</div>
          {!tutor && <p className="mb-0">{result.message}</p>}
          {tutor && (
            <>
              <p>{tutor.explanation}</p>
              {tutor.corrected && (
                <p className="mb-0">
                  Suggested: <strong>{tutor.corrected}</strong>
                </p>
              )}
            </>
          )}
          {result.explanation && <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>{result.explanation}</p>}
          {(result.status === "unverified" || result.status === "incorrect" || result.status === "close") && result.expected.length > 0 && exercise.type !== "mcq" && exercise.type !== "match" && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>
                {exercise.type === "produce" ? "Examples" : result.expected.length > 1 ? "Model answers" : "Model answer"}
              </div>
              <ul className="small mb-0">
                {result.expected.slice(0, 3).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {needsDecision && (
            <div className="stack-s" style={{ marginTop: 12 }}>
              <div className="row">
                <Button size="small" onClick={() => settle(true)} disabled={busy}>
                  Mine is correct too
                </Button>
                <Button size="small" onClick={() => settle(false)} disabled={busy}>
                  I see my mistake
                </Button>
                {aiConfigured && (
                  <Button size="small" variant="primary" onClick={askTutor} disabled={busy}>
                    {busy ? <span className="spinner" aria-label="Checking" /> : "Ask the tutor to check"}
                  </Button>
                )}
              </div>
              {!aiConfigured && <span className="tiny muted">AI checking isn't configured, so you decide by comparing with the model answers.</span>}
            </div>
          )}
          {settled === "accepted" && <p className="small mb-0" style={{ marginTop: 8 }}>Counted as correct (self-assessed).</p>}
        </div>
      )}

      {vocabId && result && !needsDecision && !nextReview && (
        <div className="stack-s" style={{ marginTop: 14 }}>
          <span className="small muted">How did that feel? This adjusts when you'll see it again.</span>
          <div className="row" role="radiogroup" aria-label="Rate your recall">
            {(["forgotten", "difficult", "good", "easy"] as Rating[]).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={rating === r} className="chip" onClick={() => setRating(r)} style={{ border: 0, background: "none", padding: 0 }}>
                <span style={rating === r ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" } : undefined}>{r === "good" ? "Good" : r[0].toUpperCase() + r.slice(1)}</span>
              </button>
            ))}
            <Button variant="primary" size="small" onClick={continueReview} disabled={busy}>
              Continue
            </Button>
          </div>
        </div>
      )}
      {nextReview && <p className="small muted" style={{ marginTop: 10 }}>Next review: {nextReview}.</p>}
    </div>
  );
}
