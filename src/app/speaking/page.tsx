import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABELS, FLUENCY_DRILLS, SCENARIOS, type ScenarioCategory } from "@/content/speaking/scenarios";
import { listSessions } from "@/lib/server/speaking";
import { aiStatus } from "@/lib/ai";
import { AiQuota } from "@/components/ai/AiQuota";
import { getProfile } from "@/lib/server/profile";
import { formatDate, plural } from "@/lib/format";
import { Badge, Card, CardLink, Notice, PageHeader, SectionHead } from "@/components/ui";

export const metadata: Metadata = { title: "Speaking Studio" };

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const ai = aiStatus();
  const sessions = await listSessions(8);
  const profile = await getProfile();
  const cats = Object.keys(CATEGORY_LABELS) as ScenarioCategory[];
  const shown = cats.filter((c) => !category || c === category);
  // Event-organisation and professional scenarios first if those are the learner's focus.
  const proFocus = profile.professionalFocus.some((f) => /event|client|meeting|negotiat|present/i.test(f));
  const ordered = proFocus ? [...shown].sort((a, b) => (a === "events" ? -1 : b === "events" ? 1 : 0)) : shown;
  return (
    <div className="page">
      <PageHeader eyebrow="Speaking Studio" title="Speak first. Polish later." lede="Realistic conversations with an AI partner that remembers your goals, recycles your expressions and corrects you the way you choose. Use your voice or type as you'd speak." />
      <div style={{ marginBottom: 24 }}><AiQuota /></div>
      {!ai.configured && (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="warning" title="AI conversations need an API key">
            Conversations with the AI partner aren&apos;t available until an AI provider is configured (<Link href="/settings#ai">how to set it up</Link>). Meanwhile, the <Link href="/speaking/fluency">fluency drills</Link> work fully offline: timed speaking with voice transcription (where your browser supports it) and self-review.
          </Notice>
        </div>
      )}
      <nav className="tabs" aria-label="Categories">
        <Link href="/speaking" className="tab" aria-current={!category ? "page" : undefined}>All</Link>
        {cats.map((c) => <Link key={c} href={`/speaking?category=${c}`} className="tab" aria-current={category === c ? "page" : undefined}>{CATEGORY_LABELS[c].label}</Link>)}
        <Link href="/speaking/fluency" className="tab">Fluency drills</Link>
      </nav>
      <div className="dash-grid">
        <div className="stack-l">
          {ordered.map((c) => (
            <section key={c}>
              <SectionHead title={CATEGORY_LABELS[c].label} />
              <p className="small muted" style={{ marginTop: -8 }}>{CATEGORY_LABELS[c].description}</p>
              <div className="grid-2">
                {SCENARIOS.filter((s) => s.category === c).map((s) => (
                  <CardLink key={s.id} href={`/speaking/new?scenario=${s.id}`}>
                    <h3>{s.title}</h3>
                    <p className="small muted mb-0">{s.summary}</p>
                    <div className="card-meta"><span>{"●".repeat(s.difficulty)}{"○".repeat(3 - s.difficulty)}</span><span>{s.defaultCorrection} mode</span>{s.targetExpressions.length > 0 && <span>{s.targetExpressions.length} target expressions</span>}</div>
                  </CardLink>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="stack-l">
          <Card className="stack-s">
            <div className="card-title">Fluency drills</div>
            <p className="small muted mb-0">Short, timed speaking: answer in 30–60 seconds, tell a story from keywords, use five target expressions…</p>
            <ul className="list small">{FLUENCY_DRILLS.slice(0, 4).map((d) => <li key={d.id}><Link href={`/speaking/fluency/${d.id}`}>{d.title}</Link> <span className="muted">· {d.seconds}s</span></li>)}</ul>
            <Link href="/speaking/fluency" className="small">All drills</Link>
          </Card>
          <Card className="stack-s">
            <div className="card-title">Recent conversations</div>
            {sessions.length ? (
              <ul className="list small">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/speaking/${s.id}`}><strong>{s.title}</strong></Link>
                    <div className="muted">{formatDate(s.startedAt)} · {plural(s.learnerTurns, "turn")} · {s.status === "active" ? <Badge tone="info">in progress</Badge> : "ended"}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted mb-0">None yet.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
