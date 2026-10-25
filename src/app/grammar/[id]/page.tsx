import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarTopic } from "@/content/grammar";
import { getVocabSet } from "@/content/vocabulary";
import { getScenario } from "@/content/speaking/scenarios";
import { aiStatus } from "@/lib/ai";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { grammarTopicSummary } from "@/lib/server/insights";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { GrammarTask } from "@/components/grammar/GrammarTask";
import { LessonOpened } from "@/components/grammar/LessonOpened";
import { pct } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: getGrammarTopic((await params).id)?.title ?? "Grammar" };
}

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getGrammarTopic((await params).id);
  if (!t) notFound();
  const progress = await getDb().select().from(schema.grammarProgress).where(eq(schema.grammarProgress.topicId, t.id)).get();
  const stat = (await grammarTopicSummary()).find((s) => s.id === t.id)!;
  const scenario = t.task.speakingScenarioId ? getScenario(t.task.speakingScenarioId) : undefined;
  const vocab = t.relatedVocabSet ? getVocabSet(t.relatedVocabSet) : undefined;
  const ai = aiStatus().configured;
  return (
    <div className="page page-narrow">
      <LessonOpened topicId={t.id} />
      <PageHeader breadcrumbs={[{ href: "/grammar", label: "Grammar Lab" }]} eyebrow={`${t.group} · ${t.level}`} title={t.title} lede={t.objective}>
        <div className="row">
          <ButtonLink href={`/grammar/${t.id}/practice`} variant="primary">Practise ({t.guided.length + t.independent.length} exercises)</ButtonLink>
          <a className="btn" href="#task">Jump to the task</a>
          {stat.attempts > 0 && <Badge tone="accent">{stat.attempts >= 5 ? `${pct(stat.accuracy)} correct so far` : `${stat.attempts} answered`}</Badge>}
        </div>
      </PageHeader>

      <article className="prose stack-l" id="lesson">
        <Card flat><p className="small mb-0"><strong>In context:</strong> {t.situation}</p></Card>
        <section>
          <h3>The idea</h3>
          {t.explanation.map((p) => <p key={p}>{p}</p>)}
        </section>
        <section>
          <h3>Form and meaning</h3>
          <div className="stack-s">
            {t.form.map((f) => (
              <div className="formula" key={f.label}><b>{f.label}:</b> {f.pattern}<br /><em>{f.example}</em></div>
            ))}
          </div>
        </section>
        <section>
          <h3>When and why we use it</h3>
          <ul>{t.use.map((u) => <li key={u}>{u}</li>)}</ul>
        </section>
        <section>
          <h3>Natural examples</h3>
          <ul>{t.examples.map((e) => <li key={e}><em>{e}</em></li>)}</ul>
        </section>
        <section>
          <h3>Don't confuse</h3>
          <div className="stack">
            {t.contrasts.map((c) => (
              <Card key={c.title} className="stack-s">
                <strong>{c.title}</strong>
                <div className="compare small"><div className="formula">{c.a}</div><div className="formula">{c.b}</div></div>
                <span className="small muted">{c.note}</span>
              </Card>
            ))}
          </div>
        </section>
        {t.italianErrors.length > 0 && (
          <section>
            <h3>Typical traps for Italian speakers</h3>
            <ul className="list">
              {t.italianErrors.map((e) => (
                <li key={e.wrong}>
                  <span className="strike">{e.wrong}</span> → <strong>{e.right}</strong>
                  <div className="small muted">{e.note}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Card className="stack-s">
          <h3 className="mt-0">Practice</h3>
          <p className="small mb-0">{t.guided.length} guided exercises, then {t.independent.length} independent ones. Wrong answers go to your mistake tracker so they come back later.</p>
          <div><ButtonLink href={`/grammar/${t.id}/practice`} variant="primary">Start practice</ButtonLink></div>
        </Card>
        <Card id="task">
          <GrammarTask
            topicId={t.id}
            title={`Your turn: ${t.task.title}`}
            prompt={t.task.prompt}
            minWords={t.task.minWords}
            modelAnswer={t.task.modelAnswer}
            previous={progress?.taskResponse ?? null}
            aiConfigured={ai}
            scenarioHref={scenario ? (ai ? `/speaking/new?scenario=${scenario.id}` : "/speaking/fluency") : undefined}
          />
        </Card>
        <section>
          <h3>Key points</h3>
          <ul>{t.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
        </section>
        {(scenario || vocab) && (
          <Card flat className="stack-s">
            <strong>Use it next</strong>
            {scenario && <Link href={`/speaking/new?scenario=${scenario.id}`}>Speaking: {scenario.title}</Link>}
            {vocab && <Link href={`/vocabulary/sets/${vocab.id}`}>Expressions: {vocab.title}</Link>}
          </Card>
        )}
      </article>
    </div>
  );
}
