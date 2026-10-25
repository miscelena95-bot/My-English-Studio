import type { Metadata } from "next";
import Link from "next/link";
import { allLibraryEntries, VOCAB_SETS } from "@/content/vocabulary";
import { GRAMMAR_TOPICS, topicExercises } from "@/content/grammar";
import { aiStatus } from "@/lib/ai";
import { buildVocabExercise } from "@/lib/exercises/vocab";
import { LIBRARY_POOL, listCollection } from "@/lib/server/vocabulary";
import { allCompletedActivities } from "@/lib/server/activity";
import { dayKey, weekStartKey } from "@/lib/domain/progress";
import { Card, PageHeader, ProgressBar, SectionHead } from "@/components/ui";
import { ExerciseSet } from "@/components/exercises/ExerciseSet";
import { Sprint } from "@/components/content/Sprint";
import { SaveLibraryButton } from "@/components/vocab/VocabButtons";

export const metadata: Metadata = { title: "Challenges" };

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const game = (await searchParams).game;
  const ai = aiStatus().configured;
  const all = [...VOCAB_SETS.flatMap((s) => s.exercises), ...GRAMMAR_TOPICS.flatMap(topicExercises)];

  if (game === "wordform" || game === "sentences") {
    const items = all.filter((e) => (game === "wordform" ? e.type === "gap" && !!e.root : e.type === "order"));
    return (
      <div className="page page-narrow">
        <PageHeader breadcrumbs={[{ href: "/real-english/challenges", label: "Challenges" }]} eyebrow="Challenge" title={game === "wordform" ? "Word formation" : "Sentence building"} />
        <ExerciseSet items={items.map((exercise) => ({ exercise }))} activity={{ kind: "challenge", skill: game === "wordform" ? "vocabulary" : "grammar", refId: game, title: game === "wordform" ? "Word formation challenge" : "Sentence-building challenge" }} aiConfigured={ai} next={[{ href: "/real-english/challenges", label: "More challenges", primary: true }]} />
      </div>
    );
  }

  // Expression of the day: deterministic by date, from the whole library.
  const lib = allLibraryEntries();
  const today = dayKey(new Date());
  const idx = Math.abs([...today].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % lib.length;
  const eod = lib[idx];
  const collection = listCollection();
  const saved = new Set(collection.map((e) => e.libraryId));

  // Sprint uses the learner's own collection when it's big enough, otherwise the library.
  const source = collection.filter((e) => e.libraryId).length >= 8 ? LIBRARY_POOL.filter((p) => saved.has(p.key)) : LIBRARY_POOL;
  const start = Math.abs([...today].reduce((h, c) => (h * 17 + c.charCodeAt(0)) | 0, 3)) % source.length;
  const sprint = [...source.slice(start), ...source.slice(0, start)].slice(0, 40).map((v) => buildVocabExercise(v, "phrase", LIBRARY_POOL));

  // Weekly mission, measured from real activity.
  const ws = weekStartKey(new Date());
  const acts = allCompletedActivities().filter((a) => dayKey(a.completedAt!) >= ws);
  const usedThisWeek = collection.filter((e) => e.lastUsedAt && dayKey(e.lastUsedAt) >= ws).length;
  const speaking = acts.filter((a) => a.skill === "speaking").length;
  const writing = acts.filter((a) => a.kind === "writing").length;
  const mission = [
    { label: "Use 5 saved expressions in your own speaking or writing", value: usedThisWeek, target: 5 },
    { label: "Complete 3 conversations or fluency drills", value: speaking, target: 3 },
    { label: "Get feedback on 2 pieces of writing (a revision counts)", value: writing, target: 2 },
  ];

  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/real-english", label: "Real English" }]} eyebrow="Games & challenges" title="Small challenges, real practice" lede="Every game reinforces something you actually need: retrieval speed, word formation, word order — or using your expressions for real." />
      <div className="dash-grid">
        <div className="stack-l">
          <section>
            <SectionHead title="Vocabulary sprint" />
            <Sprint items={sprint} />
          </section>
          <section className="grid-2">
            <Link className="card card-link" href="/real-english/challenges?game=wordform"><h3>Word formation</h3><p className="small muted mb-0">decide → decision, convenient → inconvenience… from all your sets.</p></Link>
            <Link className="card card-link" href="/real-english/challenges?game=sentences"><h3>Sentence building</h3><p className="small muted mb-0">Put the words in order: questions, indirect questions, adverbs.</p></Link>
          </section>
        </div>
        <aside className="stack-l">
          <Card className="stack-s">
            <div className="card-title">Expression of the day</div>
            <span className="phrase" style={{ fontSize: "1.4rem" }}>{eod.entry.phrase}</span>
            <p className="small mb-0">{eod.entry.definition}</p>
            <p className="small mb-0"><em>{eod.entry.examples[0]}</em></p>
            {eod.entry.italian && <p className="tiny muted mb-0">{eod.entry.italian}</p>}
            <p className="tiny mb-0">Challenge: use it once today in a conversation, a drill or an email.</p>
            <SaveLibraryButton libraryKey={eod.key} saved={saved.has(eod.key)} />
          </Card>
          <Card className="stack">
            <div className="card-title">This week&apos;s mission</div>
            {mission.map((m) => (
              <div key={m.label} className="stack-s">
                <div className="row-between small"><span>{m.label}</span><strong>{Math.min(m.value, m.target)}/{m.target}</strong></div>
                <ProgressBar value={Math.min(m.value, m.target)} max={m.target} label={m.label} thin />
              </div>
            ))}
            <span className="tiny muted">Measured from what you actually did since Monday.</span>
          </Card>
        </aside>
      </div>
    </div>
  );
}
