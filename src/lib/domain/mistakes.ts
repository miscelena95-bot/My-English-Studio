import { COMMUNICATIVE_WEIGHT, type MistakeCategory } from "./mistake-categories";

export type MistakeStatus = "active" | "improving" | "resolved";
export type MistakeSeverity = "error" | "unnatural" | "style";

export interface MistakeLike {
  id: number;
  category: string;
  severity: string;
  occurrences: number;
  status: string;
  practiceCount: number;
  consecutiveCorrect: number;
  lastSeenAt: Date;
  lastPracticedAt: Date | null;
}

const DAY = 86400000;
/** Resolved items get a spaced re-check, to confirm the improvement really stuck. */
export const RESOLVED_RECHECK_DAYS = 21;

export function priorityScore(m: MistakeLike, now: Date, focus: MistakeCategory[] = []): number {
  const weight = COMMUNICATIVE_WEIGHT[m.category as MistakeCategory] ?? 1.5;
  const daysSinceSeen = (now.getTime() - m.lastSeenAt.getTime()) / DAY;
  const recency = Math.max(0, 1.5 - daysSinceSeen / 14); // recent mistakes matter more
  const frequency = Math.log2(1 + m.occurrences) * 2;
  const severity = m.severity === "error" ? 1 : m.severity === "unnatural" ? 0.6 : 0.2;
  const progress = m.status === "improving" ? -1 : 0;
  const practisedToday = m.lastPracticedAt && now.getTime() - m.lastPracticedAt.getTime() < 12 * 3600 * 1000 ? -3 : 0;
  const focusBoost = focus.includes(m.category as MistakeCategory) ? 1.5 : 0;
  return (frequency + weight + recency + focusBoost) * severity + progress + practisedToday;
}

export function isDueForRecheck(m: MistakeLike, now: Date): boolean {
  if (m.status !== "resolved") return true;
  const last = m.lastPracticedAt ?? m.lastSeenAt;
  return now.getTime() - last.getTime() >= RESOLVED_RECHECK_DAYS * DAY;
}

/**
 * Pick a manageable set of high-value mistakes for a review session:
 * no stylistic suggestions, no more than two per category, resolved items only
 * when they're due a re-check.
 */
export function selectForReview<T extends MistakeLike>(items: T[], n: number, now: Date, focus: MistakeCategory[] = []): T[] {
  const eligible = items.filter((m) => m.severity !== "style" && isDueForRecheck(m, now));
  const ranked = [...eligible].sort((a, b) => priorityScore(b, now, focus) - priorityScore(a, now, focus));
  const perCategory = new Map<string, number>();
  const out: T[] = [];
  for (const m of ranked) {
    const c = perCategory.get(m.category) ?? 0;
    if (c >= 2) continue;
    perCategory.set(m.category, c + 1);
    out.push(m);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Update status after practice. Improvement must be shown more than once, on
 * different days, before a mistake counts as resolved.
 */
export function afterPractice(m: MistakeLike & { practiceCorrect?: number }, correct: boolean, now: Date) {
  const sameDay = m.lastPracticedAt && now.toDateString() === m.lastPracticedAt.toDateString();
  if (!correct) {
    return { status: "active" as MistakeStatus, consecutiveCorrect: 0, resolvedAt: null as Date | null };
  }
  // Two correct answers on the same day count once: spacing is what shows retention.
  const consecutive = sameDay && m.consecutiveCorrect > 0 ? m.consecutiveCorrect : m.consecutiveCorrect + 1;
  const status: MistakeStatus = consecutive >= 2 ? "resolved" : "improving";
  return { status, consecutiveCorrect: consecutive, resolvedAt: status === "resolved" ? now : null };
}

/** A new occurrence of a known mistake: it's active again, even if it was resolved. */
export function afterOccurrence(m: MistakeLike) {
  return { status: "active" as MistakeStatus, occurrences: m.occurrences + 1, consecutiveCorrect: 0, regressed: m.status === "resolved" };
}
