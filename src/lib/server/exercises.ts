import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { staticExercise } from "@/lib/exercises/registry";
import { gradeExercise } from "@/lib/exercises/grade";
import type { Exercise, ExerciseResponse, GradeResult } from "@/lib/exercises/types";
import { buildMatchExercise, buildVocabExercise, parseVocabExerciseId } from "@/lib/exercises/vocab";
import { getLibraryEntry, getVocabSet, libraryKey } from "@/content/vocabulary";
import { getMistake, logMistake, recordMistakePractice } from "./mistakes";
import { getEntry, LIBRARY_POOL, toVocabLike } from "./vocabulary";

export interface ResolvedExercise {
  exercise: Exercise;
  skill: string;
  topicId: string;
  loggable: boolean;
}

/** Build the "fix your own sentence" exercise for a tracked mistake. */
export function mistakeFixExercise(m: { id: number; original: string; corrected: string; explanation: string; category: string; context: string | null }): Exercise {
  return {
    id: `m:fix:${m.id}`,
    type: "correct",
    instruction: "This is a sentence you wrote or said. Correct it.",
    context: m.context ?? undefined,
    prompt: "Rewrite the sentence correctly.",
    source: m.original,
    answers: [m.corrected],
    // Several corrections may be valid: an unmatched answer is "unverified", never "wrong".
    open: true,
    explanation: m.explanation,
    category: m.category as Exercise["category"],
  };
}

export async function resolveExercise(id: string): Promise<ResolvedExercise | undefined> {
  const s = staticExercise(id);
  if (s) return s;

  const v = parseVocabExerciseId(id);
  if (v) {
    let like;
    if (v.key.startsWith("db")) {
      const e = await getEntry(Number(v.key.slice(2)));
      if (!e) return undefined;
      like = toVocabLike(e);
    } else {
      const lib = getLibraryEntry(v.key);
      if (!lib) return undefined;
      like = LIBRARY_POOL.find((p) => p.key === v.key)!;
    }
    return { exercise: buildVocabExercise(like, v.mode, LIBRARY_POOL), skill: "vocabulary", topicId: "review", loggable: false };
  }

  const vm = id.match(/^vm:(.+)$/);
  if (vm) {
    const set = getVocabSet(vm[1]);
    if (!set) return undefined;
    const likes = set.entries.map((e) => LIBRARY_POOL.find((p) => p.key === libraryKey(set.id, e.id))!);
    return { exercise: buildMatchExercise(id, likes), skill: "vocabulary", topicId: set.id, loggable: false };
  }

  const m = id.match(/^m:fix:(\d+)$/);
  if (m) {
    const mistake = await getMistake(Number(m[1]));
    if (!mistake) return undefined;
    return { exercise: mistakeFixExercise(mistake), skill: "grammar", topicId: "mistakes", loggable: false };
  }
  return undefined;
}

/** Turn a wrong objective answer into (learner sentence, corrected sentence) for the tracker. */
export function mistakePair(ex: Exercise, res: ExerciseResponse, g: GradeResult): { original: string; corrected: string } | null {
  if (g.status !== "incorrect") return null;
  if (ex.type === "mcq") {
    if (res.kind !== "choice" || !/_{3,}/.test(ex.prompt)) return null;
    const chosen = ex.options[res.index];
    const right = ex.options[Array.isArray(ex.answer) ? ex.answer[0] : ex.answer];
    if (!chosen) return null;
    return { original: ex.prompt.replace(/_{3,}/, chosen), corrected: ex.prompt.replace(/_{3,}/, right) };
  }
  if (ex.type === "match" || ex.type === "produce") return null;
  if (!g.learnerSentence || !g.correctSentence || g.learnerSentence === "…") return null;
  if (ex.type === "gap" && g.learnerSentence.includes("…")) return null;
  return { original: g.learnerSentence, corrected: g.correctSentence };
}

export interface SubmitInput {
  exerciseId: string;
  response: ExerciseResponse;
  activityId?: number | null;
  mistakeId?: number | null;
}

export async function submitAnswer(input: SubmitInput) {
  const resolved = await resolveExercise(input.exerciseId);
  if (!resolved) throw new Error("This exercise no longer exists. Please reload the page.");
  const { exercise, skill, topicId, loggable } = resolved;
  const grade = gradeExercise(exercise, input.response);
  const responseText =
    input.response.kind === "choice"
      ? exercise.type === "mcq"
        ? (exercise.options[input.response.index] ?? "")
        : String(input.response.index)
      : input.response.kind === "text"
        ? input.response.value
        : input.response.kind === "order"
          ? input.response.sequence.join(" ")
          : input.response.rightForLeft.join(" | ");

  const attempt = await getDb()
    .insert(schema.exerciseAttempts)
    .values({
      activityId: input.activityId ?? null,
      exerciseId: exercise.id,
      exerciseType: exercise.type,
      skill,
      topicId,
      response: responseText.slice(0, 2000),
      status: grade.status,
      isCorrect: grade.isCorrect,
      difficulty: exercise.difficulty ?? 2,
    })
    .returning({ id: schema.exerciseAttempts.id })
    .get();

  let mistakeLogged: { id: number; repeated: boolean } | null = null;
  if (input.mistakeId) {
    if (grade.isCorrect !== null) await recordMistakePractice(input.mistakeId, grade.isCorrect, responseText);
  } else if (loggable) {
    const pair = mistakePair(exercise, input.response, grade);
    if (pair)
      mistakeLogged = await logMistake({
        ...pair,
        explanation: exercise.explanation,
        category: exercise.category,
        pattern: exercise.pattern,
        source: skill === "grammar" ? "grammar" : "vocabulary",
        sourceRef: exercise.id,
        context: exercise.context ?? exercise.instruction ?? null,
        grammarTopicId: skill === "grammar" ? topicId : null,
      });
  }
  return { grade, attemptId: attempt.id, mistakeLogged };
}

/**
 * The learner decides an "unverified" answer after comparing with the model
 * answers (or after the tutor checked it). Rejected answers go to the tracker.
 */
export async function settleAttempt(attemptId: number, accepted: boolean, opts: { mistakeId?: number | null; via?: "self" | "tutor"; corrected?: string } = {}) {
  const db = getDb();
  const a = await db.select().from(schema.exerciseAttempts).where(eq(schema.exerciseAttempts.id, attemptId)).get();
  if (!a) throw new Error("Attempt not found");
  if (a.status !== "unverified") return a;
  await db
    .update(schema.exerciseAttempts)
    .set({ status: accepted ? (opts.via === "tutor" ? "correct" : "self-accepted") : "incorrect", isCorrect: accepted })
    .where(eq(schema.exerciseAttempts.id, attemptId))
    .run();
  if (opts.mistakeId) await recordMistakePractice(opts.mistakeId, accepted, a.response);
  else if (!accepted) {
    const r = await resolveExercise(a.exerciseId);
    if (r?.loggable && r.exercise.type !== "produce" && r.exercise.type !== "match") {
      const corrected = opts.corrected ?? ("answers" in r.exercise ? r.exercise.answers[0] : undefined);
      if (corrected)
        await logMistake({
          original: a.response,
          corrected,
          explanation: r.exercise.explanation,
          category: r.exercise.category,
          pattern: r.exercise.pattern,
          source: r.skill === "grammar" ? "grammar" : "vocabulary",
          sourceRef: r.exercise.id,
          grammarTopicId: r.skill === "grammar" ? r.topicId : null,
        });
    }
  }
  return (await db.select().from(schema.exerciseAttempts).where(eq(schema.exerciseAttempts.id, attemptId)).get())!;
}
