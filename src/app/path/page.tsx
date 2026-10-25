import type { Metadata } from "next";
import Link from "next/link";
import { PATH_LESSONS, PATH_UNITS, stepHref } from "@/content/path";
import { lessonProgress, nextLesson } from "@/lib/server/insights";
import { allCompletedActivities } from "@/lib/server/activity";
import { getProfile } from "@/lib/server/profile";
import { Badge, ButtonLink, Card, PageHeader, ProgressBar, SectionHead } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Learning Path" };

const KIND: Record<string, string> = { vocab: "Expressions", grammar: "Grammar", speaking: "Speaking", writing: "Writing", "real-english": "Real English" };

export default function PathPage() {
  const acts = allCompletedActivities();
  const next = nextLesson(acts);
  const profile = getProfile();
  const completed = PATH_LESSONS.filter((l) => lessonProgress(l, acts).completed).length;
  return (
    <div className="page">
      <PageHeader eyebrow="Learning Path" title="Communicative goals, step by step" lede="Each lesson combines expressions, the grammar you need, and a real speaking or writing task. Follow the order or jump to any lesson — steps tick off automatically, wherever you complete them.">
        <div className="stack-s" style={{ maxWidth: 420 }}>
          <span className="small">{completed} of {PATH_LESSONS.length} lessons complete</span>
          <ProgressBar value={completed} max={PATH_LESSONS.length} label="Learning path progress" />
        </div>
        {profile.structureBalance === "explore" && <p className="small muted">Your settings favour free exploration, so daily missions are based on your weaknesses rather than this path.</p>}
      </PageHeader>
      {next && (
        <Card className="card-feature stack" style={{ marginBottom: 40 }}>
          <span className="eyebrow" style={{ color: "inherit", opacity: 0.85 }}>Up next · {next.unit}</span>
          <h2 className="mb-0">{next.title}</h2>
          <p className="mb-0" style={{ opacity: 0.9 }}>{next.why}</p>
          <div><ButtonLink variant="primary" href={stepHref(next.steps[lessonProgress(next, acts).done.findIndex((d) => !d)] ?? next.steps[0])}>Continue this lesson</ButtonLink></div>
        </Card>
      )}
      {PATH_UNITS.map((u) => (
        <section key={u} style={{ marginBottom: 40 }}>
          <SectionHead title={u} />
          <div className="grid-2">
            {PATH_LESSONS.filter((l) => l.unit === u).map((l) => {
              const p = lessonProgress(l, acts);
              return (
                <Card key={l.id} className="stack-s" id={l.id}>
                  <div className="row-between"><Badge>{l.level}</Badge>{p.completed ? <Badge tone="success">Complete</Badge> : p.count > 0 ? <Badge tone="accent">{p.count}/{l.steps.length}</Badge> : null}</div>
                  <h3 className="mb-0">{l.title}</h3>
                  <p className="small muted mb-0">{l.objective}</p>
                  <ol className="steps small" style={{ marginTop: 8 }}>
                    {l.steps.map((s, i) => (
                      <li key={i}>
                        <div className="step" data-done={p.done[i]} style={{ padding: "6px 4px" }}>
                          <span className="step-index" aria-hidden="true">{p.done[i] ? <IconCheck size={12} /> : i + 1}</span>
                          <Link href={stepHref(s)}>{s.label}<span className="sr-only">{p.done[i] ? " (done)" : ""}</span></Link>
                          <span className="tiny muted">{KIND[s.kind]}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
