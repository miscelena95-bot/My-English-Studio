import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAI } from "@/lib/ai";
import { AnswerCheck, ProductionFeedback } from "@/lib/ai/schemas";
import { answerCheckSystemPrompt, productionSystemPrompt } from "@/lib/ai/prompts";
import { validateCorrections } from "@/lib/ai/validate";
import { resolveExercise, settleAttempt } from "./exercises";
import { buildLearnerContext } from "./learner-context";
import { logMistake } from "./mistakes";
import { markUsedExpressions } from "./vocabulary";

/** Ask the tutor to check an "unverified" open answer; the attempt is settled with the verdict. */
export async function checkAttemptWithTutor(attemptId: number, mistakeId?: number | null) {
  const a = getDb().select().from(schema.exerciseAttempts).where(eq(schema.exerciseAttempts.id, attemptId)).get();
  if (!a) throw new Error("Attempt not found");
  const r = resolveExercise(a.exerciseId);
  if (!r) throw new Error("Exercise not found");
  const ex = r.exercise;
  const ai = requireAI();
  const details = [
    `Exercise type: ${ex.type}`,
    ex.instruction ? `Instruction: ${ex.instruction}` : "",
    "prompt" in ex ? `Prompt: ${ex.prompt}` : "",
    "source" in ex ? `Original sentence: ${ex.source}` : "",
    "keyword" in ex && ex.keyword ? `Required expression: ${ex.keyword}` : "",
    ex.type === "produce" ? `Target expression(s): ${ex.targets.join("; ")}` : "",
    "answers" in ex ? `Model answers: ${ex.answers.join(" | ")}` : "",
    ex.type === "produce" ? `Example answers: ${ex.modelAnswers.join(" | ")}` : "",
    `Learner's answer: ${a.response}`,
  ]
    .filter(Boolean)
    .join("\n");
  const check = await ai.generate({ task: "answer-check", system: answerCheckSystemPrompt(), messages: [{ role: "user", content: details }], schema: AnswerCheck, maxTokens: 1500, effort: "low" });
  const accepted = check.verdict !== "incorrect";
  settleAttempt(attemptId, accepted, { mistakeId, via: "tutor", corrected: check.corrected ?? undefined });
  if (ex.type === "produce") markUsedExpressions(a.response);
  return check;
}

/** Feedback on an open production (grammar task, real-English response, follow-up, fluency drill). */
export async function productionFeedback(input: { context: string; prompt: string; targets: string[]; text: string; source: "grammar" | "speaking" | "writing" | "real-english"; sourceRef: string; askBand?: boolean; inputMode?: "typed" | "spoken" }) {
  const ai = requireAI();
  const msg = [
    `Context: ${input.context}`,
    `Task: ${input.prompt}`,
    input.targets.length ? `Target language: ${input.targets.join("; ")}` : "",
    input.inputMode === "spoken" ? "The response is a speech-to-text transcript." : "",
    input.askBand ? "Please also give a rough level impression (estimatedBand)." : "Set estimatedBand to null.",
    `\nLearner's response:\n${input.text}`,
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await ai.generate({ task: "production-feedback", system: productionSystemPrompt(buildLearnerContext()), messages: [{ role: "user", content: msg }], schema: ProductionFeedback, maxTokens: 4000, effort: "low" });
  const fb = { ...raw, corrections: validateCorrections(raw.corrections, input.text, 5), estimatedBand: input.askBand ? raw.estimatedBand : null };
  for (const c of fb.corrections) {
    if (c.kind === "style") continue;
    logMistake({ original: c.original, corrected: c.corrected, explanation: c.explanation, category: c.category, severity: c.kind, source: input.source, sourceRef: input.sourceRef, context: input.context });
  }
  return fb;
}
