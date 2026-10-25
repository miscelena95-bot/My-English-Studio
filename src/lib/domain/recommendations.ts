/**
 * Rule-based recommendations. Each rule is simple, explainable, and based on
 * the learner's recorded data — the "reason" is always shown in the UI.
 */

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  href: string;
  priority: number;
}

export interface RecInput {
  /** Active mistake counts by category (label + grammar topic to practise + matching scenario). */
  mistakeCategories: Array<{ category: string; label: string; active: number; occurrences: number; topicId?: string; topicTitle?: string }>;
  /** Grammar topic performance on objective exercises. */
  topics: Array<{ id: string; title: string; attempts: number; accuracy: number; days: number; flaggedForSpeaking: boolean; scenarioId?: string; nextTopicId?: string }>;
  /** Expressions saved recently that haven't been used in speaking/writing yet. */
  unusedNewExpressions: Array<{ id: number; phrase: string }>;
  dueReviews: number;
  aiConfigured: boolean;
}

export function recommend(i: RecInput): Recommendation[] {
  const out: Recommendation[] = [];

  // Repeated errors in a category → short contextual review.
  for (const c of i.mistakeCategories) {
    if (c.active >= 3 || c.occurrences >= 4) {
      out.push({
        id: `mistakes-${c.category}`,
        title: `Short review: ${c.label.toLowerCase()}`,
        reason: `${c.label} mistakes appeared ${c.occurrences} times in your own sentences (${c.active} still active).`,
        href: c.topicId ? `/grammar/${c.topicId}` : `/mistakes/practice?category=${c.category}`,
        priority: 80 + Math.min(15, c.occurrences),
      });
    }
  }

  for (const t of i.topics) {
    // Understands the rule but struggles to use it spontaneously → speaking task.
    const strongInExercises = t.attempts >= 6 && t.accuracy >= 0.75;
    const errorsInProduction = i.mistakeCategories.some((c) => c.topicId === t.id && c.active >= 2);
    if ((t.flaggedForSpeaking || (strongInExercises && errorsInProduction)) && t.scenarioId) {
      out.push({
        id: `transfer-${t.id}`,
        title: `Use ${t.title.toLowerCase()} in conversation`,
        reason: t.flaggedForSpeaking
          ? "You said you understand this structure but find it hard to use spontaneously."
          : `You score ${Math.round(t.accuracy * 100)}% in exercises, but the same structure still causes mistakes when you speak or write.`,
        href: i.aiConfigured ? `/speaking/new?scenario=${t.scenarioId}` : "/speaking/fluency",
        priority: 75,
      });
    }
    // Consistently good over several sessions → increase difficulty.
    if (t.attempts >= 10 && t.accuracy >= 0.85 && t.days >= 2 && !errorsInProduction) {
      out.push({
        id: `harder-${t.id}`,
        title: `Ready for more: beyond ${t.title.toLowerCase()}`,
        reason: `${Math.round(t.accuracy * 100)}% correct over ${t.attempts} items on ${t.days} different days.`,
        href: t.nextTopicId ? `/grammar/${t.nextTopicId}` : `/grammar/${t.id}`,
        priority: 40,
      });
    }
    // Struggling repeatedly → simpler explanation and guided practice.
    if (t.attempts >= 6 && t.accuracy < 0.5) {
      out.push({
        id: `support-${t.id}`,
        title: `Step back: ${t.title}`,
        reason: `Only ${Math.round(t.accuracy * 100)}% correct over ${t.attempts} items. Re-read the key points and do the guided practice first.`,
        href: `/grammar/${t.id}#lesson`,
        priority: 85,
      });
    }
  }

  // New expressions → use them in writing and conversation.
  if (i.unusedNewExpressions.length) {
    const e = i.unusedNewExpressions.slice(0, 3).map((x) => `“${x.phrase}”`);
    out.push({
      id: "use-new-expressions",
      title: "Use your new expressions",
      reason: `You've saved ${e.join(", ")} but haven't used ${i.unusedNewExpressions.length > 1 ? "them" : "it"} in your own speaking or writing yet.`,
      href: i.aiConfigured ? "/speaking/new?scenario=free-conversation" : "/writing/new?task=w-free",
      priority: 60,
    });
  }

  if (i.dueReviews >= 15) {
    out.push({ id: "reviews", title: "Catch up on reviews", reason: `${i.dueReviews} expressions are waiting. A few minutes now prevents forgetting.`, href: "/vocabulary/review", priority: 70 });
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.priority - a.priority)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .slice(0, 5);
}
