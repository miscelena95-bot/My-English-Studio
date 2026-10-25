import { z } from "zod";

/** A single correction. `original` must quote the learner's own words. */
export const Correction = z.object({
  original: z.string().describe("The learner's exact words (copied from their text) that contain the issue."),
  corrected: z.string().describe("The corrected or more natural version of the same words."),
  explanation: z.string().describe("One or two short sentences in simple English explaining why."),
  kind: z.enum(["error", "unnatural", "style"]).describe("error = grammatically/lexically wrong; unnatural = correct but not what a native speaker would say; style = optional improvement."),
  category: z.string().describe("One of: grammar, verb-tense, articles, prepositions, word-order, vocabulary, collocation, register, naturalness, spelling, sentence-structure."),
});
export type Correction = z.infer<typeof Correction>;

export const TutorTurn = z.object({
  reply: z.string().describe("Your next message in the conversation: natural, warm, B1–B2 English, ending with ONE manageable question or prompt."),
  corrections: z.array(Correction).describe("Corrections of the learner's LAST message, following the correction mode rules. Empty array if none."),
  hint: z.string().nullable().describe("Only if the learner seems stuck or asked for help: a hint that helps them continue (e.g. a starter phrase), never a full answer. Otherwise null."),
  usedTargetExpressions: z.array(z.string()).describe("Target expressions the learner used (even imperfectly) in their last message."),
});
export type TutorTurn = z.infer<typeof TutorTurn>;

export const TutorOpening = z.object({
  reply: z.string().describe("Your opening message: set the scene in role and ask one question."),
});

export const ConversationReport = z.object({
  summary: z.string().describe("2–3 sentences summarising what was discussed."),
  strengths: z.array(z.string()).describe("1–3 specific things the learner did well, quoting them where possible."),
  corrections: z.array(Correction).describe("The 3–5 most important corrections, prioritising errors that affect communication. Quote the learner's words exactly."),
  naturalAlternatives: z
    .array(z.object({ original: z.string(), alternative: z.string(), note: z.string() }))
    .describe("0–3 sentences that were fine but could sound more natural."),
  usefulExpressions: z
    .array(z.object({ phrase: z.string(), meaning: z.string(), example: z.string() }))
    .describe("Up to 5 useful expressions for this topic that the learner could use next time."),
  grammarPatterns: z
    .array(z.object({ pattern: z.string(), explanation: z.string() }))
    .describe("0–2 recurring grammar patterns observed in the learner's messages, with a short explanation."),
  fluencyTip: z.string().describe("One short, practical fluency recommendation based on this conversation. Do not claim to measure pronunciation or speed."),
  followUpTask: z.object({
    instruction: z.string().describe("A short task that requires the learner to use the new language (e.g. answer the same question again using two expressions)."),
    targetExpressions: z.array(z.string()),
  }),
});
export type ConversationReport = z.infer<typeof ConversationReport>;

const score = z.number().int().min(1).max(5);

export const WritingFeedback = z.object({
  overall: z.string().describe("2–3 sentences of honest, encouraging overall feedback."),
  taskCompletion: z.object({ met: z.boolean(), comment: z.string() }),
  scores: z
    .object({
      grammar: score,
      vocabularyRange: score,
      vocabularyAccuracy: score,
      sentenceStructure: score,
      coherence: score,
      naturalness: score,
      register: score,
      taskCompletion: score,
    })
    .describe("1 = very weak, 3 = adequate for B1–B2, 5 = excellent. Informal indicators, not exam scores."),
  annotations: z.array(Correction).describe("Specific issues, each quoting the learner's exact words. Distinguish errors from unnatural phrasing and optional style improvements. Max 12."),
  priorities: z.array(z.string()).describe("Exactly three priority improvements for the next draft."),
  naturalAlternatives: z.array(z.object({ original: z.string(), alternative: z.string() })).describe("Up to 4 more natural ways to express ideas from the text."),
  revisedVersion: z.string().describe("A revised version that keeps the learner's ideas and voice — not a completely new model text."),
  followUpTask: z.string().describe("A short follow-up writing task practising the main issue."),
  progressNotes: z
    .array(z.string())
    .describe("If a previous draft was provided: which issues improved and which remain. Otherwise an empty array."),
});
export type WritingFeedback = z.infer<typeof WritingFeedback>;

export const AnswerCheck = z.object({
  verdict: z.enum(["correct", "acceptable", "incorrect"]).describe("correct = fully right; acceptable = right but a bit unnatural; incorrect = wrong for this task."),
  explanation: z.string().describe("Short explanation in simple English."),
  corrected: z.string().nullable().describe("If not correct: a corrected version of the learner's answer that stays close to it. Otherwise null."),
});
export type AnswerCheck = z.infer<typeof AnswerCheck>;

export const ProductionFeedback = z.object({
  verdict: z.enum(["good", "minor-issues", "needs-work"]),
  comment: z.string().describe("2–3 sentences of specific feedback on content and language."),
  corrections: z.array(Correction).describe("Up to 5 corrections, quoting the learner's words exactly."),
  betterVersion: z.string().nullable().describe("A lightly improved version of the learner's text, keeping their ideas. Null if already good."),
  usedTargets: z.array(z.string()).describe("Which of the target expressions/structures the learner used correctly."),
  estimatedBand: z
    .enum(["A2", "B1", "B1+", "B2", "B2+", "C1"])
    .nullable()
    .describe("Only when explicitly asked for a level indication; otherwise null. A rough impression, not an assessment."),
});
export type ProductionFeedback = z.infer<typeof ProductionFeedback>;

export const ContentActivity = z.object({
  summary: z.string().describe("An original 3–4 sentence summary in clear B2 English. Do not copy sentences from the source."),
  keyExpressions: z.array(z.object({ phrase: z.string(), meaning: z.string() })).describe("4–6 useful expressions related to the topic."),
  comprehensionQuestions: z
    .array(z.object({ question: z.string(), options: z.array(z.string()), answerIndex: z.number().int(), explanation: z.string() }))
    .describe("3 multiple-choice questions answerable from the provided text only, 4 options each."),
  discussionQuestions: z.array(z.string()).describe("3 open questions that invite opinion, comparison or speculation."),
  productionTask: z.string().describe("A short speaking or writing task using at least two of the key expressions."),
});
export type ContentActivity = z.infer<typeof ContentActivity>;
