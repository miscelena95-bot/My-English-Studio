import type { Metadata } from "next";
import Link from "next/link";
import { progressData } from "@/lib/server/insights";
import { performanceSignal } from "@/lib/domain/level";
import { formatDate, pct, plural, relativeDay } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, ProgressBar, SectionHead, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "My Progress" };

const SKILL_LABEL: Record<string, string> = { speaking: "Speaking", writing: "Writing", grammar: "Grammar", vocabulary: "Vocabulary", reading: "Reading", listening: "Listening" };
const SKILL_NOTE: Record<string, string> = {
  speaking: "Accuracy isn't graded for open speaking; see conversations and words spoken.",
  writing: "Open writing isn't graded as right/wrong; see feedback indicators below.",
  grammar: "Grammar exercises and mistake reviews.",
  vocabulary: "Vocabulary exercises and reviews.",
  reading: "Comprehension questions in Real English.",
  listening: "Comprehension questions on listening units.",
};

export default function ProgressPage() {
  const d = progressData();
  const level = d.profile.estimatedLevel ?? d.profile.selfAssessedLevel;
  const signal = performanceSignal(level, d.evidence);
  const maxWeek = Math.max(1, ...d.weeks.map((w) => w.minutes));
  const r = d.reflection;
  const writingAvg = d.writingDrafts.length
    ? (["grammar", "vocabularyRange", "naturalness", "coherence"] as const).map((k) => ({
        k,
        avg: d.writingDrafts.reduce((s, x) => s + ((x.feedback as { scores?: Record<string, number> })?.scores?.[k] ?? 0), 0) / d.writingDrafts.length,
      }))
    : [];
  return (
    <div className="page">
      <PageHeader eyebrow="My Progress" title="What you've done, and what's changing" lede="Activity (time, sessions) and performance (accuracy, mistakes) are shown separately. Neither is an official CEFR assessment." />

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Activity" />
        <div className="grid-3">
          <Card><Stat value={d.metrics.totalMinutes} label="minutes of active practice (all time)" /></Card>
          <Card><Stat value={d.completedSessions} label="daily sessions completed" /></Card>
          <Card><Stat value={d.metrics.totalActivities} label="activities completed" /></Card>
        </div>
        {d.metrics.totalActivities > 0 ? (
          <Card style={{ marginTop: 16 }}>
            <div className="card-title">Minutes per week</div>
            <div className="bar-chart" role="img" aria-label={`Minutes per week: ${d.weeks.map((w) => `${w.label} ${w.minutes}`).join(", ")}`}>
              {d.weeks.map((w) => (
                <div className="bar" key={w.label} data-empty={w.minutes === 0}>
                  <span style={{ height: `${(w.minutes / maxWeek) * 100}%` }} />
                  {w.minutes}
                  <span style={{ background: "none", height: "auto" }} className="tiny">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div style={{ marginTop: 16 }}><EmptyState title="No activity yet" action={<ButtonLink href="/" variant="primary">Start today&apos;s session</ButtonLink>}>Your charts will appear once you&apos;ve completed a few activities. Nothing here is estimated or pre-filled.</EmptyState></div>
        )}
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="This week's reflection" />
        {r.hasData ? (
          <div className="grid-2">
            <Card className="stack-s">
              <div className="card-title">What has improved</div>
              {r.improved.length ? <ul className="small mb-0">{r.improved.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted mb-0">Not enough comparable data with last week yet (needs at least 3 items on the same topic in both weeks).</p>}
              <div className="card-title" style={{ marginTop: 12 }}>Errors becoming less frequent</div>
              {r.fewerErrors.length ? <ul className="small mb-0">{r.fewerErrors.map((x) => <li key={x.category}>{x.category}: {x.lastWeek} → {x.thisWeek}</li>)}</ul> : <p className="small muted mb-0">No clear decrease yet.</p>}
            </Card>
            <Card className="stack-s">
              <div className="card-title">Expressions retained</div>
              {r.retained.length ? <p className="small mb-0">{r.retained.join(" · ")}</p> : <p className="small muted mb-0">Expressions recalled correctly after at least a day appear here.</p>}
              <div className="card-title" style={{ marginTop: 12 }}>Needs attention</div>
              {r.needsAttention.length ? <ul className="small mb-0">{r.needsAttention.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted mb-0">Nothing urgent.</p>}
              <div className="card-title" style={{ marginTop: 12 }}>Focus for next week</div>
              {r.nextFocus.length ? <ul className="small mb-0">{r.nextFocus.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted mb-0">Keep the same balance.</p>}
            </Card>
          </div>
        ) : <Notice>No activity this week yet — the reflection is built from this week compared with last week.</Notice>}
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Performance by skill (last 30 days)" />
        <Card>
          {d.skills.map((s) => (
            <div className="skill-row" key={s.skill} style={{ gridTemplateColumns: "110px 1fr 160px" }}>
              <span>{SKILL_LABEL[s.skill]}</span>
              {s.accuracy !== null ? <ProgressBar value={s.accuracy * 100} label={`${SKILL_LABEL[s.skill]} accuracy`} /> : <span className="tiny muted">{SKILL_NOTE[s.skill]}</span>}
              <span className="skill-value">
                {s.accuracy !== null ? `${pct(s.accuracy)} of ${s.gradedItems}` : `${plural(s.practice, "activity", "activities")}`}
                {s.trend !== null && <> · {s.trend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(s.trend * 100))} pts</>}
              </span>
            </div>
          ))}
          <p className="tiny muted" style={{ marginTop: 14, marginBottom: 0 }}>Accuracy appears after 5 graded items; trend compares with the previous 30 days.</p>
        </Card>
        <div className="grid-3" style={{ marginTop: 16 }}>
          <Card className="stack-s">
            <div className="card-title">Speaking</div>
            <Stat value={d.speakingCount} label="conversations" />
            <span className="small muted">{d.speakingWords} words spoken or typed in conversations</span>
          </Card>
          <Card className="stack-s">
            <div className="card-title">Writing feedback (average)</div>
            {writingAvg.length ? writingAvg.map((w) => <div key={w.k} className="row-between small"><span>{w.k === "vocabularyRange" ? "Vocabulary range" : w.k[0].toUpperCase() + w.k.slice(1)}</span><span>{w.avg.toFixed(1)}/5</span></div>) : <span className="small muted">No AI writing feedback yet.</span>}
          </Card>
          <Card className="stack-s">
            <div className="card-title">Vocabulary</div>
            <div className="row-between small"><span>In collection</span><strong>{d.vocab.total}</strong></div>
            <div className="row-between small"><span>Mastered</span><strong>{d.vocab.mastered}</strong></div>
            <div className="row-between small"><span>Used in your own work</span><strong>{d.vocab.usedActively}</strong></div>
          </Card>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Mistakes" action={<Link href="/mistakes" className="small">Mistake tracker</Link>} />
        <Card className="stack-s">
          <div className="row-between small"><span>{d.resolvedMistakes} of {d.totalMistakes} tracked mistakes resolved (correct on two different days)</span></div>
          <ProgressBar value={d.resolvedMistakes} max={Math.max(1, d.totalMistakes)} label="Resolved mistakes" />
          {d.mistakes.length > 0 && <ul className="list small">{d.mistakes.slice(0, 6).map((m) => <li key={m.category} className="row-between"><span>{m.label}</span><span className="muted">{m.active} active · seen {m.occurrences}×</span></li>)}</ul>}
        </Card>
      </section>

      {d.topics.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHead title="Grammar topics practised" />
          <Card>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Topic</th><th>Level</th><th>Items</th><th>Accuracy</th><th>Last practised</th></tr></thead>
                <tbody>{d.topics.map((t) => <tr key={t.id}><td><Link href={`/grammar/${t.id}`}>{t.title}</Link></td><td>{t.level}</td><td>{t.attempts}</td><td>{pct(t.accuracy)}</td><td>{t.lastAt ? relativeDay(t.lastAt) : "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Level estimate" />
        <Card className="stack-s">
          <div className="row"><Badge tone="accent">Provisional: {level}</Badge>{d.diagnostic && <span className="small muted">Diagnostic taken {formatDate(d.diagnostic.createdAt, { day: "numeric", month: "long", year: "numeric" })}</span>}</div>
          {d.profile.levelEvidence?.length ? <ul className="small mb-0">{d.profile.levelEvidence.map((e) => <li key={e}>{e}</li>)}</ul> : <p className="small muted mb-0">Based on your self-assessment only.</p>}
          {signal ? <Notice tone={signal.suggestUp ? "success" : "info"}>{signal.message}{signal.suggestUp && " Consider retaking the diagnostic to update your profile."}</Notice> : <p className="small muted mb-0">The estimate will be reviewed once there are at least 30 recent B2-level grammar items, plus regular speaking and writing.</p>}
          <p className="tiny muted mb-0">This is an informal estimate to personalise your practice, not a CEFR certificate. For an official level, take a recognised exam.</p>
          <div><ButtonLink href="/welcome/diagnostic" size="small">{d.diagnostic ? "Retake the diagnostic" : "Take the diagnostic"}</ButtonLink></div>
        </Card>
      </section>

      {d.recentActivities.length > 0 && (
        <section>
          <SectionHead title="Recent activity" />
          <Card style={{ padding: "8px 20px" }}>
            <ul className="list small">{d.recentActivities.map((a) => <li key={a.id} className="row-between"><span>{a.title}</span><span className="muted">{a.itemsTotal ? `${a.itemsCorrect}/${a.itemsTotal} · ` : ""}{Math.max(1, Math.round(a.durationSec / 60))} min · {relativeDay(a.completedAt!)}</span></li>)}</ul>
          </Card>
        </section>
      )}
    </div>
  );
}
