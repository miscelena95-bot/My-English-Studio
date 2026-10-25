"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Exercise } from "@/lib/exercises/types";
import { finishActivity, startExerciseActivity } from "@/app/actions/exercises";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { Button, ButtonLink, Notice, ProgressBar } from "@/components/ui";
import { ExerciseCard, type ExerciseOutcome } from "./ExerciseCard";
import type { ActivityKind, Skill } from "@/lib/server/activity";

export interface SetItem {
  exercise: Exercise;
  vocabId?: number;
  mistakeId?: number;
}

export function ExerciseSet({
  items,
  activity,
  aiConfigured,
  next,
  summaryExtra,
  emptyMessage,
}: {
  items: SetItem[];
  activity: { kind: ActivityKind; skill: Skill; refId: string | null; title: string };
  aiConfigured: boolean;
  next?: Array<{ href: string; label: string; primary?: boolean }>;
  summaryExtra?: ReactNode;
  emptyMessage?: string;
}) {
  const [activityId, setActivityId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, ExerciseOutcome>>({});
  const [finished, setFinished] = useState<{ itemsTotal: number; itemsCorrect: number; durationSec: number } | null>(null);
  const started = useRef(false);
  const seconds = useActiveTimer();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current || !items.length) return;
    started.current = true;
    void startExerciseActivity(activity).then((r) => (r.ok ? setActivityId(r.data) : setStartError(r.error)));
  }, [activity, items.length]);

  if (!items.length) return <Notice>{emptyMessage ?? "There are no exercises here yet."}</Notice>;

  const current = items[index];
  const answered = index in outcomes;
  const results = Object.values(outcomes);

  function done(o: ExerciseOutcome) {
    setOutcomes((prev) => (index in prev ? prev : { ...prev, [index]: o }));
  }

  async function advance() {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (activityId) {
      const r = await finishActivity(activityId, seconds());
      if (r.ok) setFinished(r.data);
      else setFinished({ itemsTotal: results.length, itemsCorrect: results.filter((x) => x.isCorrect).length, durationSec: seconds() });
    } else setFinished({ itemsTotal: results.length, itemsCorrect: results.filter((x) => x.isCorrect).length, durationSec: seconds() });
  }

  if (finished) {
    const pct = finished.itemsTotal ? Math.round((finished.itemsCorrect / finished.itemsTotal) * 100) : null;
    const wrong = results.filter((o) => o.isCorrect === false).length;
    return (
      <div className="card fade-in" data-testid="set-summary">
        <div className="eyebrow">Done</div>
        <h2>Well worked.</h2>
        <p className="lede">
          {finished.itemsTotal > 0 ? (
            <>
              You answered {finished.itemsCorrect} of {finished.itemsTotal} graded items correctly{pct !== null ? ` (${pct}%)` : ""}
            </>
          ) : (
            <>You completed {results.length} items</>
          )}{" "}
          in about {Math.max(1, Math.round(finished.durationSec / 60))} minute{Math.round(finished.durationSec / 60) === 1 ? "" : "s"} of active practice.
        </p>
        {wrong > 0 && <p className="small muted">The sentences you got wrong have been added to your mistake tracker, so they'll come back for practice.</p>}
        {summaryExtra}
        <div className="row" style={{ marginTop: 16 }}>
          {(next ?? [{ href: "/", label: "Back to your learning space", primary: true }]).map((n) => (
            <ButtonLink key={n.href} href={n.href} variant={n.primary ? "primary" : "secondary"}>
              {n.label}
            </ButtonLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" ref={topRef} style={{ scrollMarginTop: 80 }}>
      {startError && <Notice tone="warning">Progress couldn&apos;t be saved for this set: {startError}</Notice>}
      <ProgressBar value={results.length} max={items.length} label="Exercise progress" thin />
      <ExerciseCard
        key={current.exercise.id + index}
        exercise={current.exercise}
        index={index}
        total={items.length}
        activityId={activityId}
        mistakeId={current.mistakeId}
        vocabId={current.vocabId}
        aiConfigured={aiConfigured}
        onDone={done}
      />
      <div className="row-between">
        <span className="small muted">
          {results.filter((o) => o.isCorrect).length} correct so far
        </span>
        <div className="row">
          {!answered && index + 1 < items.length && (
            <Button variant="ghost" onClick={() => setIndex(index + 1)}>
              Skip
            </Button>
          )}
          {answered && (
            <Button variant="primary" onClick={advance} autoFocus>
              {index + 1 < items.length ? "Next" : "Finish"}
            </Button>
          )}
          {!answered && index + 1 >= items.length && results.length > 0 && (
            <Button variant="ghost" onClick={advance}>
              Finish without answering
            </Button>
          )}
        </div>
      </div>
      <p className="tiny muted">
        <Link href="/mistakes">Mistakes</Link> from this set are tracked automatically.
      </p>
    </div>
  );
}
