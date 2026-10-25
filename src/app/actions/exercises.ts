"use server";

import { z } from "zod";
import { completeActivity, startActivity, type ActivityKind, type Skill } from "@/lib/server/activity";
import { settleAttempt, submitAnswer } from "@/lib/server/exercises";
import { checkAttemptWithTutor } from "@/lib/server/feedback";
import { recordReview } from "@/lib/server/vocabulary";
import { reviewModeOf, parseVocabExerciseId } from "@/lib/exercises/vocab";
import { ratingFromResult, type Rating } from "@/lib/domain/srs";
import { run } from "./result";
import { revalidatePath } from "next/cache";

const ResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), index: z.number().int().min(0).max(20) }),
  z.object({ kind: z.literal("text"), value: z.string().max(2000) }),
  z.object({ kind: z.literal("match"), rightForLeft: z.array(z.string().max(300)).max(12) }),
  z.object({ kind: z.literal("order"), sequence: z.array(z.string().max(60)).max(40) }),
]);

export async function startExerciseActivity(input: { kind: ActivityKind; skill: Skill; refId: string | null; title: string }) {
  return run(() => startActivity(input));
}

export async function submitExerciseAnswer(input: { exerciseId: string; response: unknown; activityId?: number | null; mistakeId?: number | null }) {
  return run(() => {
    const response = ResponseSchema.parse(input.response);
    return submitAnswer({ exerciseId: String(input.exerciseId), response, activityId: input.activityId ?? null, mistakeId: input.mistakeId ?? null });
  });
}

export async function settleUnverified(attemptId: number, accepted: boolean, mistakeId?: number | null) {
  return run(() => {
    const a = settleAttempt(attemptId, accepted, { mistakeId, via: "self" });
    return { status: a.status };
  });
}

export async function checkWithTutor(attemptId: number, mistakeId?: number | null) {
  return run(() => checkAttemptWithTutor(attemptId, mistakeId));
}

export async function finishActivity(activityId: number, durationSec: number, meta?: Record<string, unknown>) {
  return run(() => {
    const a = completeActivity(activityId, { durationSec: Math.max(0, Math.round(durationSec)), meta });
    revalidatePath("/", "layout");
    return { itemsTotal: a.itemsTotal, itemsCorrect: a.itemsCorrect, durationSec: a.durationSec };
  });
}

/** Spaced-repetition update after a review item. The learner may override the automatic rating. */
export async function reviewVocab(input: { vocabId: number; exerciseId: string; status: "correct" | "close" | "incorrect" | "unverified"; override?: Rating }) {
  return run(() => {
    const parsed = parseVocabExerciseId(input.exerciseId);
    if (!parsed) throw new Error("Not a vocabulary review item");
    const rating = input.override ?? ratingFromResult(input.status);
    const next = recordReview(input.vocabId, { rating, mode: reviewModeOf(parsed.mode), exerciseType: parsed.mode, difficulty: parsed.mode === "produce" ? 3 : parsed.mode === "recall" ? 3 : parsed.mode === "gap" ? 2 : 1 });
    return { rating, intervalDays: next.intervalDays, mastery: next.mastery, dueAt: next.dueAt.toISOString() };
  });
}
