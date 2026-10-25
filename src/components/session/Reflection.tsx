"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finishToday } from "@/app/actions/session";
import { Button, Notice } from "@/components/ui";

export function Reflection({ sessionId, completed, early }: { sessionId: number; completed: boolean; early: boolean }) {
  const [difficulty, setDifficulty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (completed) return <Notice tone="success" title="Session complete">Thanks for reflecting. See you tomorrow — or keep exploring if you have time.</Notice>;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await finishToday(sessionId, { difficulty, note });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        router.refresh();
      }}
    >
      {early && <p className="small muted mb-0">You can finish now even if some steps are open — unfinished steps simply come back in future plans.</p>}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">How did today feel?</legend>
        <div className="chips" style={{ marginTop: 8 }}>
          {["Too easy", "About right", "Challenging", "Too hard"].map((d) => (
            <label className="chip" key={d}>
              <input type="radio" name="difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} />
              <span>{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="note">One thing you learnt or want to remember (optional — in English!)</label>
        <textarea id="note" className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div><Button type="submit" variant="primary" disabled={busy}>Finish today&apos;s session</Button></div>
    </form>
  );
}
