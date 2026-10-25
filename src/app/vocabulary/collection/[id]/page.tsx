import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEntry, reviewHistory } from "@/lib/server/vocabulary";
import { describeInterval } from "@/lib/domain/srs";
import { formatDate, formatDateTime, nowMs } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { EntryActions, NotesEditor } from "@/components/vocab/VocabButtons";

export const metadata: Metadata = { title: "Expression" };

const SOURCE: Record<string, string> = { seed: "Vocabulary Lab", manual: "added by you", speaking: "a speaking session", writing: "writing feedback", "real-english": "Real English", grammar: "Grammar Lab", mistakes: "your mistakes" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const e = getEntry(Number((await params).id));
  if (!e) notFound();
  const logs = reviewHistory(e.id);
  const s = e.schedule;
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/vocabulary/collection", label: "Saved expressions" }]} eyebrow={e.partOfSpeech ?? "Expression"} title={e.phrase} lede={e.definition}>
        <div className="row">
          {s && <Badge tone="accent">{s.mastery}</Badge>}
          {s && <Badge>{s.dueAt.getTime() <= nowMs() ? "due now" : `next review ${describeInterval((s.dueAt.getTime() - nowMs()) / 86400000)}`}</Badge>}
          {e.archived && <Badge tone="warning">archived</Badge>}
          <span className="small muted">Saved {formatDate(e.createdAt, { day: "numeric", month: "long", year: "numeric" })} from {SOURCE[e.source] ?? e.source}</span>
        </div>
      </PageHeader>
      <div className="stack">
        <Card className="stack-s">
          {e.examples.length > 0 && (<><h4>Examples</h4><ul>{e.examples.map((x) => <li key={x}><em>{x}</em></li>)}</ul></>)}
          {e.collocations.length > 0 && <p><strong>Collocations:</strong> {e.collocations.join(" · ")}</p>}
          {e.synonyms.length > 0 && <p><strong>Similar:</strong> {e.synonyms.join(" · ")}</p>}
          {e.register && <p><strong>Register:</strong> {e.register}</p>}
          {(e.pronunciation || e.ipa) && <p><strong>Pronunciation:</strong> {[e.pronunciation, e.ipa].filter(Boolean).join(" · ")}</p>}
          {e.commonMistakes.map((m) => <p key={m}><strong>Watch out:</strong> {m}</p>)}
          {e.italianNote && <p><strong>For Italian speakers:</strong> {e.italianNote}</p>}
          <p className="small muted mb-0">Used in your own speaking or writing: {e.timesUsed} time{e.timesUsed === 1 ? "" : "s"}{e.lastUsedAt ? ` (last ${formatDate(e.lastUsedAt)})` : ""}.</p>
        </Card>
        <Card><NotesEditor id={e.id} notes={e.personalNotes} /></Card>
        <Card className="stack-s">
          <h4>Review history</h4>
          {s && <p className="small muted">{s.successfulRecalls} independent recalls · {s.lapses} times forgotten · ease {s.ease.toFixed(2)}</p>}
          {logs.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Exercise</th><th>Rating</th><th>Next interval</th></tr></thead>
              <tbody>{logs.map((l) => <tr key={l.id}><td>{formatDateTime(l.createdAt)}</td><td>{l.mode} ({l.exerciseType})</td><td>{l.rating}</td><td>{describeInterval(l.newInterval)}</td></tr>)}</tbody></table></div>
          ) : <p className="small muted mb-0">Not reviewed yet.</p>}
        </Card>
        <EntryActions id={e.id} archived={e.archived} />
      </div>
    </div>
  );
}
