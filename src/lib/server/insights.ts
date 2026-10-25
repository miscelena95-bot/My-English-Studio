import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { aiStatus } from "@/lib/ai";
import { GRAMMAR_TOPICS, getGrammarTopic } from "@/content/grammar";
import { PATH_LESSONS, stepActivityKey, type PathLesson } from "@/content/path";
import { FLUENCY_DRILLS, SCENARIOS, getScenario } from "@/content/speaking/scenarios";
import { WRITING_TASKS, getWritingTask } from "@/content/writing/tasks";
import { REAL_ENGLISH_UNITS, CATEGORY_INFO } from "@/content/real-english";
import { VOCAB_SETS } from "@/content/vocabulary";
import { CATEGORY_LABELS, CATEGORY_TOPICS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { activityMetrics, dayKey, skillIndicators, topicStats, weeklyReflection } from "@/lib/domain/progress";
import { planDailySession, stepCompletion, type DailyPlan } from "@/lib/domain/planner";
import { recommend } from "@/lib/domain/recommendations";
import { allCompletedActivities } from "./activity";
import { listMistakes } from "./mistakes";
import { getProfile, type Profile } from "./profile";
import { collectionStats, listCollection } from "./vocabulary";

const DAY = 86400000;

function allAttempts() {
  return getDb().select().from(schema.exerciseAttempts).all();
}

function daysSince(d: Date | undefined | null, now: Date) {
  return d ? Math.floor((now.getTime() - d.getTime()) / DAY) : null;
}

export function lessonProgress(lesson: PathLesson, acts = allCompletedActivities()) {
  const done = lesson.steps.map((s) => {
    const k = stepActivityKey(s);
    return acts.some((a) => k.kinds.includes(a.kind) && a.refId === k.refId);
  });
  return { done, completed: done.every(Boolean), count: done.filter(Boolean).length };
}

export function nextLesson(acts = allCompletedActivities()) {
  return PATH_LESSONS.find((l) => !lessonProgress(l, acts).completed) ?? null;
}

/** Pick a Real English unit matching the learner's interests, least recently done first. */
export function suggestContent(profile: Profile, acts = allCompletedActivities()) {
  const interests = new Set(profile.interests);
  const doneIds = new Set(acts.filter((a) => a.kind === "real-english").map((a) => a.refId));
  const ranked = [...REAL_ENGLISH_UNITS].sort((a, b) => {
    const ia = interests.has(CATEGORY_INFO[a.category].interest) ? 0 : 1;
    const ib = interests.has(CATEGORY_INFO[b.category].interest) ? 0 : 1;
    const da = doneIds.has(a.id) ? 1 : 0;
    const db = doneIds.has(b.id) ? 1 : 0;
    return da - db || ia - ib;
  });
  return ranked[0];
}

export function mistakeCategorySummary() {
  const mistakes = listMistakes();
  const map = new Map<string, { active: number; occurrences: number }>();
  for (const m of mistakes) {
    if (m.severity === "style") continue;
    const c = map.get(m.category) ?? { active: 0, occurrences: 0 };
    c.occurrences += m.occurrences;
    if (m.status !== "resolved") c.active++;
    map.set(m.category, c);
  }
  return [...map.entries()]
    .map(([category, v]) => {
      const topicId = CATEGORY_TOPICS[category as MistakeCategory]?.[0];
      return { category, label: CATEGORY_LABELS[category as MistakeCategory] ?? category, ...v, topicId, topicTitle: topicId ? getGrammarTopic(topicId)?.title : undefined };
    })
    .sort((a, b) => b.active - a.active || b.occurrences - a.occurrences);
}

export function grammarTopicSummary() {
  const stats = topicStats(allAttempts(), "grammar", 60);
  const flags = getDb().select().from(schema.grammarProgress).all();
  return GRAMMAR_TOPICS.map((t, i) => {
    const s = stats.find((x) => x.topicId === t.id);
    const scenario = t.task.speakingScenarioId ?? SCENARIOS.find((sc) => sc.grammarFocus === t.id)?.id;
    return {
      id: t.id,
      title: t.title,
      level: t.level,
      attempts: s?.attempts ?? 0,
      accuracy: s?.accuracy ?? 0,
      days: s?.days ?? 0,
      lastAt: s?.lastAt ?? null,
      flaggedForSpeaking: flags.find((f) => f.topicId === t.id)?.flaggedForSpeaking ?? false,
      scenarioId: scenario,
      nextTopicId: GRAMMAR_TOPICS[i + 1]?.id,
    };
  });
}

export function recommendations() {
  const collection = listCollection();
  const now = Date.now();
  return recommend({
    mistakeCategories: mistakeCategorySummary(),
    topics: grammarTopicSummary(),
    unusedNewExpressions: collection.filter((e) => e.timesUsed === 0 && now - e.createdAt.getTime() < 7 * DAY && e.schedule && e.schedule.repetitions >= 1).map((e) => ({ id: e.id, phrase: e.phrase })),
    dueReviews: collectionStats().due,
    aiConfigured: aiStatus().configured,
  });
}

export function buildPlan(minutesOverride?: number): DailyPlan {
  const profile = getProfile();
  const acts = allCompletedActivities();
  const now = new Date();
  const lastOf = (skill: string) => acts.find((a) => a.skill === skill)?.completedAt;
  const cats = mistakeCategorySummary();
  const activeMistakes = cats.reduce((s, c) => s + c.active, 0);
  const topics = grammarTopicSummary();
  const diag = getDb().select().from(schema.diagnosticResults).orderBy(desc(schema.diagnosticResults.id)).get();
  const struggling = topics.filter((t) => t.attempts >= 4 && t.accuracy < 0.6).sort((a, b) => a.accuracy - b.accuracy)[0];
  const diagWeak = diag?.weakTopics.find((id) => !topics.find((t) => t.id === id && t.attempts >= 4));
  const weakTopic = struggling
    ? { id: struggling.id, title: struggling.title, reason: `${struggling.title}: ${Math.round(struggling.accuracy * 100)}% correct in recent exercises.` }
    : diagWeak
      ? { id: diagWeak, title: getGrammarTopic(diagWeak)!.title, reason: `Your diagnostic suggested ${getGrammarTopic(diagWeak)!.title.toLowerCase()} needs attention.` }
      : null;

  const lesson = profile.structureBalance === "explore" ? null : nextLesson(acts);
  const find = <T extends { kind: string }>(steps: T[], kind: string) => steps.find((s) => s.kind === kind) as (T & Record<string, string>) | undefined;
  const ls = lesson
    ? (() => {
        const v = find(lesson.steps, "vocab");
        const g = find(lesson.steps, "grammar");
        const sp = find(lesson.steps, "speaking");
        const w = find(lesson.steps, "writing");
        return {
          id: lesson.id,
          title: lesson.title,
          objective: lesson.objective,
          vocabSetId: v?.setId,
          grammarTopicId: g?.topicId,
          grammarTitle: g ? getGrammarTopic(g.topicId)?.title : undefined,
          scenarioId: sp?.scenarioId,
          scenarioTitle: sp ? getScenario(sp.scenarioId)?.title : undefined,
          writingTaskId: w?.taskId,
          writingTitle: w ? getWritingTask(w.taskId)?.title : undefined,
        };
      })()
    : null;

  // Rotate fallbacks by day so the plan varies, preferring the learner's professional focus.
  const dayIndex = Math.floor(now.getTime() / DAY);
  const proFirst = SCENARIOS.filter((s) => s.category !== "free");
  const sc = proFirst[dayIndex % proFirst.length];
  const wt = WRITING_TASKS.filter((t) => t.id !== "w-free")[dayIndex % (WRITING_TASKS.length - 1)];
  const drill = FLUENCY_DRILLS[dayIndex % FLUENCY_DRILLS.length];
  const content = suggestContent(profile, acts);
  const learnedSets = new Set(listCollection().map((e) => e.setId));
  const newSet = VOCAB_SETS.find((s) => !learnedSets.has(s.id)) ?? null;

  return planDailySession({
    minutes: minutesOverride ?? profile.sessionMinutes,
    aiConfigured: aiStatus().configured,
    dueReviews: collectionStats().due,
    topMistake: cats[0] && cats[0].active > 0 ? { label: cats[0].label, count: cats[0].occurrences } : null,
    activeMistakes,
    weakTopic,
    daysSinceSpeaking: daysSince(lastOf("speaking"), now),
    daysSinceWriting: daysSince(lastOf("writing"), now),
    lesson: ls,
    fallbackScenario: { id: sc.id, title: sc.title, objective: sc.objectives[0] },
    fallbackWriting: { id: wt.id, title: wt.title, objective: wt.objective },
    fallbackDrill: { id: drill.id, title: drill.title },
    content: content ? { id: content.id, title: content.title, objective: content.objective } : null,
    newSet: newSet ? { id: newSet.id, title: newSet.title } : null,
  });
}

// ---------------------------------------------------------------- daily sessions

export function todaySession() {
  const today = dayKey(new Date());
  return getDb().select().from(schema.dailySessions).where(eq(schema.dailySessions.date, today)).orderBy(desc(schema.dailySessions.id)).get();
}

export function startDailySession(minutes?: number) {
  const plan = buildPlan(minutes);
  return getDb().insert(schema.dailySessions).values({ date: dayKey(new Date()), minutes: plan.minutes, plan, startedAt: new Date() }).returning().get();
}

export function sessionStatus(s: NonNullable<ReturnType<typeof todaySession>>) {
  const plan = s.plan as DailyPlan;
  const acts = getDb().select().from(schema.activities).where(gte(schema.activities.startedAt, s.startedAt)).all();
  const done = stepCompletion(plan.steps, acts, !!s.completedAt);
  const minutes = Math.round(acts.filter((a) => a.completedAt).reduce((sum, a) => sum + a.durationSec, 0) / 60);
  return { plan, done, minutes, activities: acts.filter((a) => a.completedAt) };
}

export function completeDailySession(id: number, reflection: { difficulty?: string; note?: string }) {
  getDb()
    .update(schema.dailySessions)
    .set({ completedAt: new Date(), reflection: { difficulty: reflection.difficulty?.slice(0, 20), note: reflection.note?.slice(0, 500) } })
    .where(and(eq(schema.dailySessions.id, id)))
    .run();
}

export function completedDailySessions() {
  return getDb().select().from(schema.dailySessions).all().filter((s) => s.completedAt);
}

// ---------------------------------------------------------------- dashboard & progress

export function dashboardData() {
  const profile = getProfile();
  const acts = allCompletedActivities();
  const now = new Date();
  const metrics = activityMetrics(acts, now, { breakUntil: profile.breakUntil });
  const attempts = allAttempts();
  return {
    profile,
    metrics,
    skills: skillIndicators(acts, attempts, now),
    vocab: collectionStats(now),
    recentExpressions: listCollection().slice(0, 5),
    mistakes: mistakeCategorySummary().slice(0, 4),
    recentSpeaking: getDb().select().from(schema.conversationSessions).orderBy(desc(schema.conversationSessions.startedAt)).limit(3).all(),
    recommendations: recommendations(),
    content: suggestContent(profile, acts),
    sessionsThisWeek: completedDailySessions().filter((s) => s.date >= dayKey(new Date(now.getTime() - 6 * DAY))).length,
    hasHistory: acts.length > 0,
  };
}

export function progressData() {
  const profile = getProfile();
  const acts = allCompletedActivities();
  const attempts = allAttempts();
  const now = new Date();
  const mistakes = listMistakes();
  const events = getDb().select().from(schema.mistakeEvents).all();
  const catOf = new Map(mistakes.map((m) => [m.id, m.category]));
  const retained = getDb()
    .select()
    .from(schema.reviewLogs)
    .innerJoin(schema.vocabEntries, eq(schema.reviewLogs.vocabId, schema.vocabEntries.id))
    .where(gte(schema.reviewLogs.createdAt, new Date(now.getTime() - 7 * DAY)))
    .all()
    .filter((r) => (r.review_logs.rating === "good" || r.review_logs.rating === "easy") && r.review_logs.previousInterval >= 1 && r.review_logs.mode !== "recognition")
    .map((r) => r.vocab_entries.phrase);

  const reflection = weeklyReflection({
    now,
    activities: acts,
    attempts,
    mistakeEvents: events.filter((e) => catOf.has(e.mistakeId)).map((e) => ({ category: catOf.get(e.mistakeId)!, type: e.type, createdAt: e.createdAt })),
    retainedExpressions: Array.from(new Set(retained)),
    topicTitle: (id) => getGrammarTopic(id)?.title ?? VOCAB_SETS.find((s) => s.id === id)?.title ?? id,
    categoryLabel: (c) => CATEGORY_LABELS[c as MistakeCategory] ?? c,
  });

  const writing = getDb().select().from(schema.writingDrafts).all().filter((d) => d.feedbackSource === "ai");
  const speakingSessions = getDb().select().from(schema.conversationSessions).all();
  const b2Topics = new Set(GRAMMAR_TOPICS.filter((t) => t.level.startsWith("B2")).map((t) => t.id));
  const recentB2 = attempts.filter((a) => a.topicId && b2Topics.has(a.topicId) && a.isCorrect !== null && now.getTime() - a.createdAt.getTime() < 30 * DAY);

  // Weekly minutes for the last 8 weeks (only weeks that exist in the data range).
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * DAY);
    const start = new Date(end.getTime() - 7 * DAY);
    const m = acts.filter((a) => a.completedAt! > start && a.completedAt! <= end).reduce((s, a) => s + a.durationSec, 0);
    return { label: i === 0 ? "This week" : `${i}w ago`, minutes: Math.round(m / 60) };
  }).reverse();

  return {
    profile,
    metrics: activityMetrics(acts, now, { breakUntil: profile.breakUntil }),
    skills: skillIndicators(acts, attempts, now),
    reflection,
    weeks,
    vocab: collectionStats(now),
    mistakes: mistakeCategorySummary(),
    resolvedMistakes: mistakes.filter((m) => m.status === "resolved").length,
    totalMistakes: mistakes.length,
    topics: grammarTopicSummary().filter((t) => t.attempts > 0),
    writingDrafts: writing,
    speakingCount: speakingSessions.filter((s) => s.learnerTurns > 0).length,
    speakingWords: speakingSessions.reduce((s, x) => s + x.learnerWords, 0),
    evidence: {
      b2Accuracy: recentB2.length ? recentB2.filter((a) => a.isCorrect).length / recentB2.length : null,
      b2Attempts: recentB2.length,
      speakingSessions: speakingSessions.filter((s) => s.learnerTurns >= 3 && now.getTime() - s.startedAt.getTime() < 30 * DAY).length,
      writingWithFeedback: writing.filter((d) => now.getTime() - d.createdAt.getTime() < 30 * DAY).length,
    },
    diagnostic: getDb().select().from(schema.diagnosticResults).orderBy(desc(schema.diagnosticResults.id)).get(),
    recentActivities: acts.slice(0, 15),
    completedSessions: completedDailySessions().length,
  };
}
