import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABELS, WRITING_TASKS, type WritingCategory } from "@/content/writing/tasks";
import { listSubmissions } from "@/lib/server/writing";
import { listMistakes } from "@/lib/server/mistakes";
import { CATEGORY_LABELS as MISTAKE_LABELS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { aiStatus } from "@/lib/ai";
import { formatDate } from "@/lib/format";
import { Badge, Card, CardLink, Notice, PageHeader, SectionHead } from "@/components/ui";

export const metadata: Metadata = { title: "Writing Workshop" };

const STATUS: Record<string, string> = { draft: "Draft", feedback: "Feedback received", revised: "Revised" };

export default async function WritingPage() {
  const subs = await listSubmissions();
  const writingMistakes = (await listMistakes()).filter((m) => m.source === "writing" && m.status !== "resolved");
  const byCat = new Map<string, number>();
  for (const m of writingMistakes) byCat.set(m.category, (byCat.get(m.category) ?? 0) + m.occurrences);
  const cats = Object.keys(CATEGORY_LABELS) as WritingCategory[];
  return (
    <div className="page">
      <PageHeader eyebrow="Writing Workshop" title="Write, get feedback, revise" lede="Realistic tasks with a clear audience and purpose. Feedback separates real errors from optional improvements, and you revise your own text before seeing a revised version." />
      {!aiStatus().configured && <div style={{ marginBottom: 24 }}><Notice tone="warning" title="AI feedback isn't configured">You can still write, save drafts, revise and compare versions, and use a structured self-review checklist. <Link href="/settings#ai">Set up AI feedback</Link>.</Notice></div>}
      <div className="dash-grid">
        <div className="stack-l">
          {cats.map((c) => {
            const tasks = WRITING_TASKS.filter((t) => t.category === c);
            if (!tasks.length) return null;
            return (
              <section key={c}>
                <SectionHead title={CATEGORY_LABELS[c]} />
                <div className="grid-2">
                  {tasks.map((t) => (
                    <CardLink key={t.id} href={`/writing/new?task=${t.id}`}>
                      <h3>{t.title}</h3>
                      <p className="small muted mb-0">{t.objective}</p>
                      <div className="card-meta"><span>{t.register}</span><span>{t.words.min}–{t.words.max} words</span><span>{"●".repeat(t.difficulty)}{"○".repeat(3 - t.difficulty)}</span></div>
                    </CardLink>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="stack-l">
          <Card className="stack-s">
            <div className="card-title">My writing</div>
            {subs.length ? (
              <ul className="list small">
                {subs.slice(0, 12).map((s) => (
                  <li key={s.id}>
                    <Link href={`/writing/s/${s.id}`}><strong>{s.title}</strong></Link>
                    <div className="muted">{STATUS[s.status] ?? s.status} · {s.versions} version{s.versions > 1 ? "s" : ""} · {formatDate(s.updatedAt)}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted mb-0">Nothing yet. Choose a task to start.</p>}
          </Card>
          <Card className="stack-s">
            <div className="card-title">Recurring writing issues</div>
            {byCat.size ? (
              <ul className="list small">
                {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => <li key={c} className="row-between"><Link href={`/mistakes?category=${c}`}>{MISTAKE_LABELS[c as MistakeCategory] ?? c}</Link><Badge>×{n}</Badge></li>)}
              </ul>
            ) : <p className="small muted mb-0">Issues found in your writing feedback will be tracked here across submissions.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
