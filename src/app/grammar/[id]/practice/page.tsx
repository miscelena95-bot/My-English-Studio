import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGrammarTopic } from "@/content/grammar";
import { aiStatus } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { ExerciseSet } from "@/components/exercises/ExerciseSet";

export const metadata: Metadata = { title: "Grammar practice" };

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const t = getGrammarTopic((await params).id);
  if (!t) notFound();
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/grammar", label: "Grammar Lab" }, { href: `/grammar/${t.id}`, label: t.title }]} eyebrow="Practice" title={t.title} lede="Guided items first, then independent ones. Open answers that differ from the model are never marked wrong automatically." />
      <ExerciseSet
        items={[...t.guided, ...t.independent].map((exercise) => ({ exercise }))}
        activity={{ kind: "grammar-practice", skill: "grammar", refId: t.id, title: `Grammar: ${t.title}` }}
        aiConfigured={aiStatus().configured}
        next={[{ href: `/grammar/${t.id}#task`, label: "Now use it: communicative task", primary: true }, { href: "/grammar", label: "Grammar Lab" }]}
      />
    </div>
  );
}
