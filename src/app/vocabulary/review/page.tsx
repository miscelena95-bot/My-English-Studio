import { nowMs } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { aiStatus } from "@/lib/ai";
import { buildVocabExercise, modeForReview } from "@/lib/exercises/vocab";
import { dueEntries, LIBRARY_POOL, listCollection, reviewModeFor, toVocabLike } from "@/lib/server/vocabulary";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ExerciseSet } from "@/components/exercises/ExerciseSet";
import { describeInterval } from "@/lib/domain/srs";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  const due = dueEntries(new Date(), 12);
  const ai = aiStatus().configured;
  if (!due.length) {
    const upcoming = listCollection()
      .filter((e) => e.schedule)
      .sort((a, b) => a.schedule!.dueAt.getTime() - b.schedule!.dueAt.getTime())[0];
    return (
      <div className="page page-narrow">
        <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }]} eyebrow="Spaced repetition" title="All caught up" />
        <EmptyState
          title={upcoming ? "Nothing is due right now" : "Your collection is empty"}
          action={<ButtonLink href="/vocabulary" variant="primary">{upcoming ? "Learn a new set" : "Choose your first set"}</ButtonLink>}
        >
          {upcoming ? (
            <>Next review: <strong>{upcoming.phrase}</strong>, {describeInterval((upcoming.schedule!.dueAt.getTime() - nowMs()) / 86400000)}. Mastered expressions aren&apos;t shown again without a reason.</>
          ) : (
            "Add expressions from the Vocabulary Lab, or save them from feedback, and they'll appear here when they're due."
          )}
        </EmptyState>
      </div>
    );
  }
  const items = due.map((e) => {
    const like = toVocabLike(e);
    return { exercise: buildVocabExercise(like, modeForReview(reviewModeFor(e), like), LIBRARY_POOL), vocabId: e.id };
  });
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }]} eyebrow="Spaced repetition" title={`${due.length} expression${due.length > 1 ? "s" : ""} to review`} lede="Newer expressions ask you to recognise them; older ones ask you to recall and then use them. Rate each one honestly — the schedule adapts." />
      <ExerciseSet
        items={items}
        activity={{ kind: "vocab-review", skill: "vocabulary", refId: "review", title: "Vocabulary review" }}
        aiConfigured={ai}
        next={[{ href: "/session", label: "Back to today's session", primary: true }, { href: "/vocabulary/collection", label: "My collection" }]}
        summaryExtra={<p className="small"><Link href="/vocabulary/collection">See when each expression comes back</Link>.</p>}
      />
    </div>
  );
}
