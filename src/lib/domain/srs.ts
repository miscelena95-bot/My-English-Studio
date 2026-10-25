/**
 * Spaced-repetition scheduler (SM-2 family, adapted for expressions).
 *
 * Inputs considered, as required by the learning design:
 *  - previous performance (ease factor, lapses)
 *  - number of successful recalls (repetitions)
 *  - time since the previous review (late successful reviews earn credit)
 *  - whether the item was recalled independently (mode: recognition < recall < production)
 *  - exercise difficulty
 *
 * Deterministic (no random fuzz) so that scheduling is testable and explainable.
 */

export type Rating = "forgotten" | "difficult" | "good" | "easy";
export type ReviewMode = "recognition" | "recall" | "production";
export type Mastery = "new" | "learning" | "reviewing" | "mastered";

export interface ReviewState {
  ease: number;
  intervalDays: number;
  repetitions: number;
  successfulRecalls: number;
  lapses: number;
  mastery: Mastery;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface ReviewInput {
  rating: Rating;
  mode: ReviewMode;
  /** 1 easy … 3 hard */
  difficulty?: 1 | 2 | 3;
  now: Date;
}

const DAY = 24 * 60 * 60 * 1000;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL = 180;
/** A forgotten item comes back later in the same day (relearning). */
export const RELEARN_MINUTES = 10;

const MODE_FACTOR: Record<ReviewMode, number> = { recognition: 0.7, recall: 1, production: 1.2 };
const DIFFICULTY_FACTOR: Record<1 | 2 | 3, number> = { 1: 0.9, 2: 1, 3: 1.1 };

export function newReviewState(now: Date): ReviewState {
  return {
    ease: 2.3,
    intervalDays: 0,
    repetitions: 0,
    successfulRecalls: 0,
    lapses: 0,
    mastery: "new",
    dueAt: now,
    lastReviewedAt: null,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function scheduleReview(prev: ReviewState, input: ReviewInput): ReviewState {
  const { rating, mode, now } = input;
  const difficulty = input.difficulty ?? 2;
  const elapsedDays = prev.lastReviewedAt ? Math.max(0, (now.getTime() - prev.lastReviewedAt.getTime()) / DAY) : 0;
  const overdueDays = Math.max(0, elapsedDays - prev.intervalDays);

  if (rating === "forgotten") {
    return {
      ...prev,
      ease: clamp(prev.ease - 0.2, MIN_EASE, MAX_EASE),
      intervalDays: 0,
      repetitions: 0,
      lapses: prev.lapses + 1,
      mastery: "learning",
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
      lastReviewedAt: now,
    };
  }

  const easeDelta = rating === "difficult" ? -0.15 : rating === "easy" ? 0.15 : 0;
  const ease = clamp(prev.ease + easeDelta, MIN_EASE, MAX_EASE);
  const reps = prev.repetitions + 1;

  let interval: number;
  if (prev.repetitions === 0) {
    interval = rating === "easy" ? 3 : rating === "difficult" ? 0.5 : 1;
  } else if (prev.repetitions === 1) {
    interval = rating === "easy" ? 6 : rating === "difficult" ? 2 : 3;
  } else {
    // Late but still remembered → the memory is stronger than scheduled; give half the overdue time as credit.
    const base = prev.intervalDays + (rating === "difficult" ? 0 : overdueDays / 2);
    const mult = rating === "difficult" ? 1.2 : rating === "easy" ? ease * 1.3 : ease;
    interval = base * mult;
  }

  // Recognising an expression is weaker evidence than producing it.
  interval *= MODE_FACTOR[mode] * (rating === "difficult" ? 1 : DIFFICULTY_FACTOR[difficulty]);
  interval = clamp(Math.round(interval * 10) / 10, 0.5, MAX_INTERVAL);

  const successfulRecalls = prev.successfulRecalls + (mode === "recognition" ? 0 : 1);
  const mastery: Mastery =
    interval >= 21 && successfulRecalls >= 3 && mode !== "recognition" ? "mastered" : reps >= 2 ? "reviewing" : "learning";

  return {
    ease,
    intervalDays: interval,
    repetitions: reps,
    successfulRecalls,
    lapses: prev.lapses,
    mastery,
    dueAt: new Date(now.getTime() + interval * DAY),
    lastReviewedAt: now,
  };
}

/** Exercise mode for the next review, so retrieval gets harder as the item matures. */
export function nextReviewMode(state: Pick<ReviewState, "mastery" | "repetitions" | "lapses">): ReviewMode {
  if (state.mastery === "new" || state.repetitions === 0) return "recognition";
  if (state.mastery === "learning" || state.repetitions < 3) return "recall";
  return "production";
}

/** Map an automatically graded result onto a rating; the learner may override it. */
export function ratingFromResult(status: "correct" | "close" | "incorrect" | "unverified"): Rating {
  if (status === "correct") return "good";
  if (status === "close" || status === "unverified") return "difficult";
  return "forgotten";
}

export function isDue(state: Pick<ReviewState, "dueAt">, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}

export function describeInterval(days: number): string {
  if (days < 1 / 24) return "in a few minutes";
  if (days < 1) return "later today";
  if (days < 1.5) return "tomorrow";
  if (days < 7) return `in ${Math.round(days)} days`;
  if (days < 30) return `in ${Math.round(days / 7)} week${Math.round(days / 7) > 1 ? "s" : ""}`;
  return `in ${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? "s" : ""}`;
}
