import "server-only";
import type { LearnerContext } from "@/lib/ai/prompts";
import { CATEGORY_LABELS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { getProfile } from "./profile";
import { mistakesForReview } from "./mistakes";
import { listCollection } from "./vocabulary";
import { phraseCore } from "@/lib/exercises/vocab";

export async function buildLearnerContext(): Promise<LearnerContext> {
  const p = await getProfile();
  const mistakes = (await mistakesForReview(5)).map(
    (m) => `${CATEGORY_LABELS[m.category as MistakeCategory] ?? m.category}: “${m.original}” → “${m.corrected}”${m.occurrences > 1 ? ` (${m.occurrences} times)` : ""}`,
  );
  return {
    name: p.name,
    level: p.estimatedLevel ?? p.selfAssessedLevel,
    interests: p.interests,
    professionalFocus: p.professionalFocus,
    recurringMistakes: mistakes,
    recentExpressions: await recyclableExpressions(8),
  };
}

/** Expressions the learner is actively learning (not new, not mastered), least-used first. */
export async function recyclableExpressions(n: number): Promise<string[]> {
  return (await listCollection())
    .filter((e) => e.schedule && (e.schedule.mastery === "learning" || e.schedule.mastery === "reviewing"))
    .sort((a, b) => a.timesUsed - b.timesUsed || (b.schedule!.lastReviewedAt?.getTime() ?? 0) - (a.schedule!.lastReviewedAt?.getTime() ?? 0))
    .slice(0, n)
    .map((e) => phraseCore(e.phrase));
}
