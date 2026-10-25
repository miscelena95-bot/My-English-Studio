"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviseDraft } from "@/app/actions/writing";
import { Button, Notice } from "@/components/ui";

export function ReviseButton({ submissionId }: { submissionId: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); const r = await reviseDraft(submissionId); setBusy(false); if (r.ok) router.refresh(); else setErr(r.error); }}>
        Revise my text
      </Button>
      {err && <Notice tone="error">{err}</Notice>}
    </>
  );
}

export function RevealRevision({ text, revising }: { text: string; revising: boolean }) {
  const [show, setShow] = useState(false);
  if (show) return <div className="card card-flat"><div className="card-title">Revised version (keeps your ideas)</div><p className="serif" style={{ whiteSpace: "pre-wrap", fontSize: "1.05rem" }}>{text}</p></div>;
  return (
    <div className="stack-s">
      <p className="small muted mb-0">{revising ? "Compare after you've made your own changes." : "You'll learn more if you revise your text first, using the notes above."}</p>
      <div><Button size="small" onClick={() => setShow(true)}>{revising ? "Show the revised version" : "Show it anyway"}</Button></div>
    </div>
  );
}
