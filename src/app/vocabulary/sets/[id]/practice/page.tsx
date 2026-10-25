import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVocabSet, libraryKey } from "@/content/vocabulary";
import { aiStatus } from "@/lib/ai";
import { buildMatchExercise, buildVocabExercise } from "@/lib/exercises/vocab";
import { LIBRARY_POOL } from "@/lib/server/vocabulary";
import { PageHeader } from "@/components/ui";
import { ExerciseSet } from "@/components/exercises/ExerciseSet";

export const metadata: Metadata = { title: "Practise expressions" };

export default async function SetPractice({ params }: { params: Promise<{ id: string }> }) {
  const set = getVocabSet((await params).id);
  if (!set) notFound();
  const likes = set.entries.map((e) => LIBRARY_POOL.find((p) => p.key === libraryKey(set.id, e.id))!);
  // Order: meet the meanings → recognise → use in context → produce.
  const handcrafted = set.exercises;
  const items = [
    buildMatchExercise(`vm:${set.id}`, likes),
    ...likes.slice(0, 3).map((v) => buildVocabExercise(v, "gap", LIBRARY_POOL)),
    ...handcrafted.filter((x) => x.type !== "produce"),
    ...handcrafted.filter((x) => x.type === "produce"),
  ];
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }, { href: `/vocabulary/sets/${set.id}`, label: set.title }]} eyebrow="Practice" title={set.title} lede="From recognising to using: context, collocations, natural choices, then your own sentences." />
      <ExerciseSet
        items={items.map((exercise) => ({ exercise }))}
        activity={{ kind: "vocab-practice", skill: "vocabulary", refId: set.id, title: `Expressions: ${set.title}` }}
        aiConfigured={aiStatus().configured}
        next={[{ href: `/vocabulary/sets/${set.id}`, label: "Save these expressions" }, { href: "/vocabulary/review", label: "Review due expressions", primary: true }]}
      />
    </div>
  );
}
