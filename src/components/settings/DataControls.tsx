"use client";

import { useState } from "react";
import { deleteLearningRecords, setBreak } from "@/app/actions/profile";
import { Button } from "@/components/ui";

export function BreakControl({ breakUntil }: { breakUntil: string | null }) {
  const [value, setValue] = useState(breakUntil ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="row">
      <label className="label" htmlFor="break">Take a break until</label>
      <input id="break" type="date" className="input" style={{ maxWidth: 200 }} value={value} onChange={(e) => setValue(e.target.value)} />
      <Button size="small" onClick={async () => { const r = await setBreak(value || null); setMsg(r.ok ? (r.data ? `Break set until ${r.data}.` : "Break ended. Welcome back!") : r.error); }}>Save</Button>
      {breakUntil && <Button size="small" variant="ghost" onClick={async () => { setValue(""); const r = await setBreak(null); setMsg(r.ok ? "Break ended. Welcome back!" : r.error); }}>End break</Button>}
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}

export function DeleteControls() {
  const [msg, setMsg] = useState<string | null>(null);
  async function del(kind: "transcripts" | "writing" | "everything", question: string) {
    if (!window.confirm(question)) return;
    await deleteLearningRecords(kind);
    setMsg(kind === "transcripts" ? "All conversation transcripts were deleted." : "All writing submissions were deleted.");
  }
  return (
    <div className="stack-s">
      <div className="row">
        <Button size="small" variant="danger" onClick={() => del("transcripts", "Delete all conversation transcripts and reports? Your progress statistics and tracked mistakes are kept.")}>Delete conversation transcripts</Button>
        <Button size="small" variant="danger" onClick={() => del("writing", "Delete all writing submissions and drafts? Tracked mistakes are kept.")}>Delete writing</Button>
        <Button size="small" variant="danger" onClick={() => del("everything", "Delete EVERYTHING and start again from onboarding? This can't be undone.")}>Reset the whole studio</Button>
      </div>
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}
