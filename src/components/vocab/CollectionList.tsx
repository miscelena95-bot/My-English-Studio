"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";

export interface CollectionRow {
  id: number;
  phrase: string;
  definition: string;
  mastery: string;
  due: boolean;
  next: string;
  source: string;
  timesUsed: number;
  tags: string[];
}

const MASTERY_TONE: Record<string, "neutral" | "info" | "accent" | "success"> = { new: "neutral", learning: "info", reviewing: "accent", mastered: "success" };

export function CollectionList({ rows }: { rows: CollectionRow[] }) {
  const [q, setQ] = useState("");
  const [mastery, setMastery] = useState("all");
  const [source, setSource] = useState("all");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!s || r.phrase.toLowerCase().includes(s) || r.definition.toLowerCase().includes(s) || r.tags.some((t) => t.toLowerCase().includes(s))) &&
        (mastery === "all" || (mastery === "due" ? r.due : mastery === "unused" ? r.timesUsed === 0 : r.mastery === mastery)) &&
        (source === "all" || r.source === source),
    );
  }, [rows, q, mastery, source]);
  const sources = Array.from(new Set(rows.map((r) => r.source)));
  return (
    <div className="stack">
      <div className="grid-3">
        <div className="field">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phrase, meaning or set…" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m">Status</label>
          <select id="m" className="select" value={mastery} onChange={(e) => setMastery(e.target.value)}>
            <option value="all">All</option>
            <option value="due">Due for review</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="reviewing">Reviewing</option>
            <option value="mastered">Mastered</option>
            <option value="unused">Not used in my own work yet</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="src">Saved from</label>
          <select id="src" className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">Everywhere</option>
            {sources.map((s) => <option key={s} value={s}>{s === "seed" ? "Vocabulary Lab" : s}</option>)}
          </select>
        </div>
      </div>
      <p className="small muted" aria-live="polite">{filtered.length} of {rows.length} expressions</p>
      {filtered.length ? (
        <div className="card" style={{ padding: "8px 20px" }}>
          <ul className="list">
            {filtered.map((r) => (
              <li key={r.id} className="row-between" style={{ alignItems: "flex-start", paddingTop: 12 }}>
                <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                  <Link href={`/vocabulary/collection/${r.id}`} className="phrase">{r.phrase}</Link>
                  <div className="small muted">{r.definition}</div>
                </div>
                <div className="row small" style={{ gap: 8 }}>
                  <Badge tone={MASTERY_TONE[r.mastery] ?? "neutral"}>{r.mastery}</Badge>
                  {r.due ? <Badge tone="clay">due</Badge> : <span className="muted">{r.next}</span>}
                  {r.timesUsed > 0 && <span className="muted" title="Times you used it in speaking or writing">used ×{r.timesUsed}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState title="No matching expressions">Try a different search or filter.</EmptyState>
      )}
    </div>
  );
}
