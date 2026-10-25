/**
 * Progress calculations. Everything here is computed from recorded activity —
 * there are no hard-coded numbers. Activity metrics (time, sessions) are kept
 * separate from performance indicators (accuracy), and neither is presented
 * as a proficiency level.
 */

export const TIMEZONE = process.env.STUDIO_TIMEZONE || "Europe/Rome";
const DAY = 86400000;

export function dayKey(d: Date, tz = TIMEZONE): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
}

/** Monday of the week containing `d`, as YYYY-MM-DD in the studio timezone. */
export function weekStartKey(d: Date, tz = TIMEZONE): string {
  const key = dayKey(d, tz);
  const [y, m, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dow = (utc.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utc.getTime() - dow * DAY).toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

export interface ActivityLike {
  kind: string;
  skill: string;
  refId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationSec: number;
  itemsTotal: number;
  itemsCorrect: number;
}

export interface ActivityMetrics {
  minutesToday: number;
  minutesThisWeek: number;
  activitiesThisWeek: number;
  activeDaysThisWeek: number;
  /** Consecutive days with at least one completed activity, ending today or yesterday. */
  streak: number;
  /** Minutes per day for the last 7 days, oldest first. */
  last7: Array<{ day: string; minutes: number }>;
  totalMinutes: number;
  totalActivities: number;
}

export function activityMetrics(acts: ActivityLike[], now: Date, opts: { breakUntil?: string | null } = {}): ActivityMetrics {
  const done = acts.filter((a) => a.completedAt);
  const today = dayKey(now);
  const week = weekStartKey(now);
  const byDay = new Map<string, number>();
  for (const a of done) {
    const k = dayKey(a.completedAt!);
    byDay.set(k, (byDay.get(k) ?? 0) + a.durationSec);
  }
  const inWeek = done.filter((a) => dayKey(a.completedAt!) >= week);
  const minutes = (sec: number) => Math.round(sec / 60);

  // Streak: count back from today (or yesterday if nothing yet today). Days inside a
  // declared break don't break the streak — the learner shouldn't be punished for resting.
  let streak = 0;
  let cursor = byDay.has(today) ? today : addDaysKey(today, -1);
  for (let i = 0; i < 400; i++) {
    if (byDay.has(cursor)) streak++;
    else if (!(opts.breakUntil && cursor <= opts.breakUntil)) break;
    cursor = addDaysKey(cursor, -1);
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const k = addDaysKey(today, i - 6);
    return { day: k, minutes: minutes(byDay.get(k) ?? 0) };
  });

  return {
    minutesToday: minutes(byDay.get(today) ?? 0),
    minutesThisWeek: minutes(inWeek.reduce((s, a) => s + a.durationSec, 0)),
    activitiesThisWeek: inWeek.length,
    activeDaysThisWeek: new Set(inWeek.map((a) => dayKey(a.completedAt!))).size,
    streak,
    last7,
    totalMinutes: minutes(done.reduce((s, a) => s + a.durationSec, 0)),
    totalActivities: done.length,
  };
}

export interface AttemptLike {
  skill: string;
  topicId: string | null;
  isCorrect: boolean | null;
  createdAt: Date;
}

export type SkillId = "speaking" | "writing" | "grammar" | "vocabulary" | "reading" | "listening";
export const SKILLS: SkillId[] = ["speaking", "writing", "grammar", "vocabulary", "reading", "listening"];

export interface SkillIndicator {
  skill: SkillId;
  /** Share of graded objective items answered correctly in the window (null = not enough data). */
  accuracy: number | null;
  gradedItems: number;
  /** Completed activities for this skill in the window. */
  practice: number;
  minutes: number;
  /** Accuracy change vs the previous window, when both windows have data. */
  trend: number | null;
}

const MIN_ITEMS = 5;

function accuracyOf(items: AttemptLike[]) {
  const graded = items.filter((a) => a.isCorrect !== null);
  return graded.length >= MIN_ITEMS ? graded.filter((a) => a.isCorrect).length / graded.length : null;
}

export function skillIndicators(acts: ActivityLike[], attempts: AttemptLike[], now: Date, windowDays = 30): SkillIndicator[] {
  const from = now.getTime() - windowDays * DAY;
  const prevFrom = from - windowDays * DAY;
  return SKILLS.map((skill) => {
    const cur = attempts.filter((a) => a.skill === skill && a.createdAt.getTime() >= from);
    const prev = attempts.filter((a) => a.skill === skill && a.createdAt.getTime() >= prevFrom && a.createdAt.getTime() < from);
    const acc = accuracyOf(cur);
    const prevAcc = accuracyOf(prev);
    const a = acts.filter((x) => x.completedAt && x.skill === skill && x.completedAt.getTime() >= from);
    return {
      skill,
      accuracy: acc,
      gradedItems: cur.filter((x) => x.isCorrect !== null).length,
      practice: a.length,
      minutes: Math.round(a.reduce((s, x) => s + x.durationSec, 0) / 60),
      trend: acc !== null && prevAcc !== null ? acc - prevAcc : null,
    };
  });
}

export interface TopicStat {
  topicId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  days: number;
  lastAt: Date;
}

export function topicStats(attempts: AttemptLike[], skill: string, sinceDays = 60, now = new Date()): TopicStat[] {
  const from = now.getTime() - sinceDays * DAY;
  const map = new Map<string, AttemptLike[]>();
  for (const a of attempts) {
    if (a.skill !== skill || !a.topicId || a.isCorrect === null || a.createdAt.getTime() < from) continue;
    map.set(a.topicId, [...(map.get(a.topicId) ?? []), a]);
  }
  return [...map.entries()].map(([topicId, items]) => {
    const correct = items.filter((x) => x.isCorrect).length;
    return {
      topicId,
      attempts: items.length,
      correct,
      accuracy: correct / items.length,
      days: new Set(items.map((x) => dayKey(x.createdAt))).size,
      lastAt: new Date(Math.max(...items.map((x) => x.createdAt.getTime()))),
    };
  });
}

export interface MistakeEventLike {
  category: string;
  createdAt: Date;
  type: string;
}

export interface WeeklyReflection {
  weekStart: string;
  minutes: number;
  activeDays: number;
  activities: number;
  improved: string[];
  fewerErrors: Array<{ category: string; thisWeek: number; lastWeek: number }>;
  retained: string[];
  needsAttention: string[];
  nextFocus: string[];
  hasData: boolean;
}

/**
 * Build the weekly reflection from real data. Each statement is derived from
 * a comparison the learner could verify themselves.
 */
export function weeklyReflection(input: {
  now: Date;
  activities: ActivityLike[];
  attempts: AttemptLike[];
  mistakeEvents: MistakeEventLike[];
  retainedExpressions: string[];
  topicTitle: (id: string) => string;
  categoryLabel: (c: string) => string;
}): WeeklyReflection {
  const { now } = input;
  const ws = weekStartKey(now);
  const lastWs = addDaysKey(ws, -7);
  const inWeek = (d: Date, start: string) => {
    const k = dayKey(d);
    return k >= start && k < addDaysKey(start, 7);
  };
  const acts = input.activities.filter((a) => a.completedAt && inWeek(a.completedAt, ws));
  const minutes = Math.round(acts.reduce((s, a) => s + a.durationSec, 0) / 60);

  // Improved: grammar topics with better accuracy this week than last week (min 3 items each).
  const improved: string[] = [];
  const topics = new Set(input.attempts.map((a) => a.topicId).filter(Boolean) as string[]);
  for (const t of topics) {
    const cur = input.attempts.filter((a) => a.topicId === t && a.isCorrect !== null && inWeek(a.createdAt, ws));
    const prev = input.attempts.filter((a) => a.topicId === t && a.isCorrect !== null && inWeek(a.createdAt, lastWs));
    if (cur.length >= 3 && prev.length >= 3) {
      const ca = cur.filter((a) => a.isCorrect).length / cur.length;
      const pa = prev.filter((a) => a.isCorrect).length / prev.length;
      if (ca - pa >= 0.15) improved.push(`${input.topicTitle(t)}: ${Math.round(pa * 100)}% → ${Math.round(ca * 100)}% correct`);
    }
  }

  // Errors becoming less frequent: occurrences per category this week vs last week.
  const occ = (start: string) => {
    const m = new Map<string, number>();
    for (const e of input.mistakeEvents) if ((e.type === "occurred" || e.type === "regressed") && inWeek(e.createdAt, start)) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  };
  const cur = occ(ws);
  const prev = occ(lastWs);
  const fewerErrors = [...prev.entries()]
    .filter(([c, n]) => n >= 2 && (cur.get(c) ?? 0) < n)
    .map(([category, lastWeek]) => ({ category: input.categoryLabel(category), thisWeek: cur.get(category) ?? 0, lastWeek }));

  // Needs attention: skills with no practice this week (speaking & writing first), and frequent error categories.
  const needsAttention: string[] = [];
  for (const skill of ["speaking", "writing", "vocabulary", "grammar"]) if (!acts.some((a) => a.skill === skill)) needsAttention.push(`No ${skill} practice yet this week`);
  const topThisWeek = [...cur.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topThisWeek && topThisWeek[1] >= 3) needsAttention.push(`${input.categoryLabel(topThisWeek[0])} came up ${topThisWeek[1]} times this week`);

  const nextFocus: string[] = [];
  if (topThisWeek && topThisWeek[1] >= 2) nextFocus.push(`Targeted practice on ${input.categoryLabel(topThisWeek[0]).toLowerCase()}`);
  if (!acts.some((a) => a.skill === "speaking")) nextFocus.push("At least two speaking sessions");
  if (!acts.some((a) => a.skill === "writing")) nextFocus.push("One piece of writing with a revision");
  if (input.retainedExpressions.length === 0) nextFocus.push("Daily expression reviews to build retention");

  return {
    weekStart: ws,
    minutes,
    activeDays: new Set(acts.map((a) => dayKey(a.completedAt!))).size,
    activities: acts.length,
    improved,
    fewerErrors,
    retained: input.retainedExpressions.slice(0, 8),
    needsAttention,
    nextFocus: nextFocus.slice(0, 3),
    hasData: acts.length > 0,
  };
}
