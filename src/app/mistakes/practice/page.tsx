import type { Metadata } from "next";
import { GRAMMAR_TOPICS, topicExercises } from "@/content/grammar";
import { aiStatus } from "@/lib/ai";
import { CATEGORY_TOPICS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { listMistakes, mistakesForReview } from "@/lib/server/mistakes";
import { mistakeFixExercise } from "@/lib/server/exercises";
import { selectForReview } from "@/lib/domain/mistakes";
import { EmptyState, ButtonLink, PageHeader } from "@/components/ui";
import { ExerciseSet, type SetItem } from "@/components/exercises/ExerciseSet";
import type { Exercise } from "@/lib/exercises/types";

export const metadata: Metadata = { title: "Practise your mistakes" };

/** Find a different exercise that tests the same pattern or category, to check transfer to a new context. */
function relatedExercise(m: { category: string; patternKey: string; grammarTopicId: string | null; sourceRef: string | null; practiceCount: number }): Exercise | null {
  const topicIds = [m.grammarTopicId, ...(CATEGORY_TOPICS[m.category as MistakeCategory] ?? [])].filter(Boolean) as string[];
  const pool = GRAMMAR_TOPICS.filter((t) => topicIds.includes(t.id))
    .flatMap(topicExercises)
    .filter((e) => e.id !== m.sourceRef && e.type !== "produce" && e.type !== "match");
  const pattern = m.patternKey.split(":")[1];
  const samePattern = pool.filter((e) => e.pattern && e.pattern.toLowerCase().replace(/[^a-z0-9]+/g, "-") === pattern);
  const sameCategory = pool.filter((e) => e.category === m.category);
  const candidates = samePattern.length ? samePattern : sameCategory;
  return candidates.length ? candidates[m.practiceCount % candidates.length] : null;
}

export default async function MistakePractice({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const chosen = category ? selectForReview(listMistakes().filter((m) => m.category === category), 5, new Date()) : mistakesForReview(5);
  if (!chosen.length)
    return (
      <div className="page page-narrow">
        <PageHeader breadcrumbs={[{ href: "/mistakes", label: "Mistake tracker" }]} eyebrow="Targeted practice" title="Nothing to practise right now" />
        <EmptyState title="No high-value mistakes are due" action={<ButtonLink href="/">Back to your learning space</ButtonLink>}>Resolved mistakes come back for a check after three weeks. Keep speaking and writing — new patterns will appear here.</EmptyState>
      </div>
    );
  const items: SetItem[] = [];
  for (const m of chosen) {
    items.push({ exercise: mistakeFixExercise(m), mistakeId: m.id });
    const rel = relatedExercise(m);
    if (rel) items.push({ exercise: { ...rel, instruction: `Same pattern, new context. ${rel.instruction ?? ""}`.trim() }, mistakeId: m.id });
  }
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/mistakes", label: "Mistake tracker" }]} eyebrow="Targeted practice" title={`${chosen.length} mistake${chosen.length > 1 ? "s" : ""} worth fixing`} lede="Chosen by how often they happen, how much they affect communication, and your current goals. First correct your own sentence, then use the same pattern in a new context." />
      <ExerciseSet items={items} activity={{ kind: "mistake-review", skill: "grammar", refId: category ?? "mixed", title: "Mistake review" }} aiConfigured={aiStatus().configured} next={[{ href: "/mistakes", label: "See your tracker", primary: true }, { href: "/session", label: "Today's session" }]} />
    </div>
  );
}
