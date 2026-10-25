"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMistake } from "@/app/actions/mistakes";
import { Badge, Button } from "@/components/ui";
import { InlineDiff } from "@/components/feedback/CorrectionList";

export interface MistakeRowData {
  id: number;
  original: string;
  corrected: string;
  explanation: string;
  categoryLabel: string;
  status: string;
  severity: string;
  occurrences: number;
  practiceCount: number;
  practiceCorrect: number;
  source: string;
  context: string | null;
  lastSeen: string;
  firstSeen: string;
  events: Array<{ type: string; when: string; text: string | null }>;
}

const STATUS_TONE: Record<string, "danger" | "accent" | "success"> = { active: "danger", improving: "accent", resolved: "success" };

export function MistakeRow({ m }: { m: MistakeRowData }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <li className="stack-s">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div><span className="strike">{m.original}</span></div>
          <div><strong>{m.corrected}</strong></div>
          <div className="small"><InlineDiff from={m.original} to={m.corrected} /></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
          <Badge>{m.categoryLabel}</Badge>
          {m.severity !== "error" && <Badge tone="warning">{m.severity === "unnatural" ? "unnatural" : "style"}</Badge>}
          <span className="small muted">×{m.occurrences}</span>
        </div>
      </div>
      <p className="small muted mb-0">{m.explanation}</p>
      <div className="row small">
        <button className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide history" : "History"}</button>
        <span className="muted">From {m.source}{m.context ? ` · ${m.context}` : ""} · last seen {m.lastSeen} · practised {m.practiceCorrect}/{m.practiceCount}</span>
      </div>
      {open && (
        <div className="card card-flat small stack-s">
          <ul className="mb-0">
            {m.events.map((e, i) => (
              <li key={i}>{e.when}: {e.type === "occurred" ? "made this mistake" : e.type === "regressed" ? "came back after being resolved" : e.type === "practised-correct" ? "practised correctly" : "practised — still wrong"}{e.text ? ` — “${e.text}”` : ""}</li>
            ))}
          </ul>
          <div>
            <Button size="small" variant="danger" onClick={async () => { if (confirm("Remove this from your tracker? Use this if it wasn't really a mistake.")) { await removeMistake(m.id); router.refresh(); } }}>
              This wasn&apos;t a mistake — remove
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
