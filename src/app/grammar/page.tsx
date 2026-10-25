import type { Metadata } from "next";
import { GRAMMAR_GROUPS, GRAMMAR_TOPICS } from "@/content/grammar";
import { grammarTopicSummary, mistakeCategorySummary } from "@/lib/server/insights";
import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { Badge, CardLink, PageHeader, ProgressBar, SectionHead } from "@/components/ui";
import { pct } from "@/lib/format";

export const metadata: Metadata = { title: "Grammar Lab" };

export default async function GrammarPage() {
  const stats = new Map((await grammarTopicSummary()).map((t) => [t.id, t]));
  const diag = await getDb().select().from(schema.diagnosticResults).orderBy(desc(schema.diagnosticResults.id)).get();
  const mistakeTopics = new Set((await mistakeCategorySummary()).filter((c) => c.active >= 2 && c.topicId).map((c) => c.topicId!));
  // Prioritise by real performance: struggling topics, then mistakes in your own work, then the diagnostic.
  const priority = GRAMMAR_TOPICS.map((t) => {
    const s = stats.get(t.id)!;
    const reasons: string[] = [];
    if (s.attempts >= 4 && s.accuracy < 0.65) reasons.push(`${pct(s.accuracy)} correct in exercises`);
    if (mistakeTopics.has(t.id)) reasons.push("recurring mistakes in your speaking/writing");
    if (diag?.weakTopics.includes(t.id) && s.attempts < 6) reasons.push("flagged by your diagnostic");
    if (s.flaggedForSpeaking) reasons.push("you want to use it more spontaneously");
    return { t, reasons };
  }).filter((x) => x.reasons.length).slice(0, 4);

  return (
    <div className="page">
      <PageHeader eyebrow="Grammar Lab" title="Grammar for real communication" lede="Short, clear lessons built around situations from your work — then guided practice, independent practice and a task where you use the structure yourself." />
      {priority.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHead title="Prioritised for you" />
          <div className="grid-2">
            {priority.map(({ t, reasons }) => (
              <CardLink key={t.id} href={`/grammar/${t.id}`}>
                <h3>{t.title}</h3>
                <p className="small muted mb-0">Because: {reasons.join("; ")}.</p>
              </CardLink>
            ))}
          </div>
        </section>
      )}
      {GRAMMAR_GROUPS.map((g) => (
        <section key={g} style={{ marginBottom: 40 }}>
          <SectionHead title={g} />
          <div className="grid-auto">
            {GRAMMAR_TOPICS.filter((t) => t.group === g).map((t) => {
              const s = stats.get(t.id)!;
              return (
                <CardLink key={t.id} href={`/grammar/${t.id}`}>
                  <div className="row-between"><Badge>{t.level}</Badge>{s.attempts > 0 && <span className="tiny muted">{s.attempts} answered</span>}</div>
                  <h3 style={{ marginTop: 10 }}>{t.title}</h3>
                  <p className="small muted">{t.objective}</p>
                  {s.attempts >= 5 ? <ProgressBar value={s.accuracy * 100} label={`${t.title} accuracy`} thin /> : <span className="tiny muted">{s.attempts ? "Keep practising to see your accuracy" : "Not started"}</span>}
                </CardLink>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
