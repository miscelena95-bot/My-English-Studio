"use client";

import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/exercises/types";
import { finishActivity, startExerciseActivity, submitExerciseAnswer } from "@/app/actions/exercises";
import { Button, Card, Notice } from "@/components/ui";

/** 90-second recognition sprint. Answers are graded on the server like any exercise. */
export function Sprint({ items, seconds = 90 }: { items: Exercise[]; seconds?: number }) {
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [i, setI] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [left, setLeft] = useState(seconds);
  const [flash, setFlash] = useState<null | boolean>(null);
  const activity = useRef<number | null>(null);
  const end = useRef(0);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      const l = Math.max(0, Math.round((end.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        setPhase("done");
        if (activity.current) void finishActivity(activity.current, seconds);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, seconds]);

  async function start() {
    const r = await startExerciseActivity({ kind: "challenge", skill: "vocabulary", refId: "sprint", title: "Vocabulary sprint" });
    if (r.ok) activity.current = r.data;
    end.current = Date.now() + seconds * 1000;
    setPhase("running");
  }

  async function answer(idx: number) {
    const ex = items[i % items.length];
    const r = await submitExerciseAnswer({ exerciseId: ex.id, response: { kind: "choice", index: idx }, activityId: activity.current });
    const ok = r.ok && r.data.grade.isCorrect === true;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    setFlash(ok);
    setTimeout(() => setFlash(null), 350);
    setI((x) => x + 1);
  }

  if (!items.length) return <Notice>Add a few expression sets to your collection first.</Notice>;
  if (phase === "ready")
    return (
      <Card className="stack">
        <p className="mb-0">Match as many definitions to expressions as you can in {seconds} seconds. Speed builds retrieval — don&apos;t overthink.</p>
        <div><Button variant="primary" onClick={start}>Start the sprint</Button></div>
      </Card>
    );
  if (phase === "done")
    return (
      <Card className="stack">
        <h3 className="mb-0">{score.right} correct out of {score.total}</h3>
        <p className="small muted mb-0">Saved to your activity history. Try to beat it tomorrow.</p>
        <div><Button onClick={() => { setScore({ right: 0, total: 0 }); setI(0); setLeft(seconds); setPhase("ready"); }}>Play again</Button></div>
      </Card>
    );
  const ex = items[i % items.length];
  if (ex.type !== "mcq") return null;
  return (
    <Card className="stack" style={{ borderColor: flash === null ? undefined : flash ? "var(--success)" : "var(--danger)" }}>
      <div className="row-between"><span className="timer">0:{String(left).padStart(2, "0")}</span><span className="small">{score.right} / {score.total}</span></div>
      <p className="exercise-prompt mb-0">{ex.prompt}</p>
      <div className="options">{ex.options.map((o, k) => <button key={`${i}-${k}`} type="button" className="option" onClick={() => answer(k)}><span className="option-key">{String.fromCharCode(65 + k)}</span>{o}</button>)}</div>
    </Card>
  );
}
