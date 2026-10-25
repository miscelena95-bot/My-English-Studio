import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getWritingTask, type WritingTask } from "@/content/writing/tasks";
import { requireAI } from "@/lib/ai";
import { WritingFeedback } from "@/lib/ai/schemas";
import { writingSystemPrompt } from "@/lib/ai/prompts";
import { validateWritingFeedback } from "@/lib/ai/validate";
import { wordCount } from "@/lib/domain/text";
import { completeActivity, startActivity } from "./activity";
import { buildLearnerContext } from "./learner-context";
import { logMistake } from "./mistakes";
import { markUsedExpressions } from "./vocabulary";

export type Submission = typeof schema.writingSubmissions.$inferSelect;
export type Draft = typeof schema.writingDrafts.$inferSelect;
export const MAX_WRITING_CHARS = 6000;

export function createSubmission(taskId: string) {
  const task = getWritingTask(taskId);
  if (!task) throw new Error("Unknown writing task");
  const db = getDb();
  const sub = db.insert(schema.writingSubmissions).values({ taskId, title: task.title }).returning().get();
  db.insert(schema.writingDrafts).values({ submissionId: sub.id, version: 1, text: "", wordCount: 0 }).run();
  return sub;
}

export function getSubmission(id: number) {
  const db = getDb();
  const sub = db.select().from(schema.writingSubmissions).where(eq(schema.writingSubmissions.id, id)).get();
  if (!sub) return undefined;
  const drafts = db.select().from(schema.writingDrafts).where(eq(schema.writingDrafts.submissionId, id)).orderBy(asc(schema.writingDrafts.version)).all();
  return { submission: sub, drafts, task: getWritingTask(sub.taskId) as WritingTask };
}

export function listSubmissions() {
  const db = getDb();
  const subs = db.select().from(schema.writingSubmissions).orderBy(desc(schema.writingSubmissions.updatedAt)).all();
  return subs.map((s) => {
    const drafts = db.select().from(schema.writingDrafts).where(eq(schema.writingDrafts.submissionId, s.id)).orderBy(desc(schema.writingDrafts.version)).all();
    return { ...s, latest: drafts[0], versions: drafts.length };
  });
}

function currentDraft(id: number) {
  const data = getSubmission(id);
  if (!data) throw new Error("Submission not found");
  return { ...data, current: data.drafts[data.drafts.length - 1] };
}

/** Autosave: updates the latest draft while it has no feedback yet. */
export function saveDraft(submissionId: number, text: string) {
  const { current } = currentDraft(submissionId);
  const clean = text.slice(0, MAX_WRITING_CHARS);
  if (current.feedbackSource) throw new Error("This draft already has feedback. Start a revision to keep editing.");
  const db = getDb();
  db.update(schema.writingDrafts).set({ text: clean, wordCount: wordCount(clean) }).where(eq(schema.writingDrafts.id, current.id)).run();
  db.update(schema.writingSubmissions).set({ updatedAt: new Date() }).where(eq(schema.writingSubmissions.id, submissionId)).run();
}

export function startRevision(submissionId: number) {
  const { current } = currentDraft(submissionId);
  if (!current.feedbackSource) return current;
  return getDb()
    .insert(schema.writingDrafts)
    .values({ submissionId, version: current.version + 1, text: current.text, wordCount: current.wordCount })
    .returning()
    .get();
}

function recordWritingActivity(sub: Submission, task: WritingTask, draft: Draft, seconds?: number) {
  const id = startActivity({ kind: "writing", skill: "writing", refId: task.id, title: task.title, meta: { submissionId: sub.id, version: draft.version, words: draft.wordCount } });
  completeActivity(id, { durationSec: seconds ?? Math.min(1800, draft.wordCount * 6), itemsTotal: 1, itemsCorrect: 0 });
  return id;
}

/** AI feedback on the current draft, compared with the previous one when there is one. */
export async function requestAIFeedback(submissionId: number, opts: { seconds?: number } = {}) {
  const data = currentDraft(submissionId);
  const { current, drafts, task, submission } = data;
  if (wordCount(current.text) < 20) throw new Error("Write at least 20 words before asking for feedback.");
  const previous = drafts.length > 1 ? drafts[drafts.length - 2] : null;
  const ai = requireAI();
  const prompt = [
    `TASK: ${task.title}`,
    `Objective: ${task.objective}`,
    `Audience: ${task.audience}`,
    `Context: ${task.context}`,
    `Instructions: ${task.instructions}`,
    `Register: ${task.register}. Suggested length: ${task.words.min}–${task.words.max} words.`,
    task.usefulExpressions.length ? `Useful expressions offered to the learner: ${task.usefulExpressions.join("; ")}` : "",
    previous ? `\nPREVIOUS DRAFT (version ${previous.version}):\n${previous.text}` : "",
    `\nCURRENT DRAFT (version ${current.version}, ${wordCount(current.text)} words):\n${current.text}`,
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await ai.generate({ task: "writing-feedback", system: writingSystemPrompt(buildLearnerContext()), messages: [{ role: "user", content: prompt }], schema: WritingFeedback, maxTokens: 8000, effort: "medium" });
  const feedback = validateWritingFeedback(raw, current.text);
  const db = getDb();
  db.update(schema.writingDrafts).set({ feedback, feedbackSource: "ai" }).where(eq(schema.writingDrafts.id, current.id)).run();
  db.update(schema.writingSubmissions).set({ status: drafts.length > 1 ? "revised" : "feedback", updatedAt: new Date() }).where(eq(schema.writingSubmissions.id, submissionId)).run();
  for (const a of feedback.annotations) {
    if (a.kind === "style") continue;
    logMistake({ original: a.original, corrected: a.corrected, explanation: a.explanation, category: a.category, severity: a.kind, source: "writing", sourceRef: `submission:${submissionId}`, context: task.title });
  }
  markUsedExpressions(current.text);
  recordWritingActivity(submission, task, current, opts.seconds);
  return feedback;
}

/** Without AI: structured self-review against the task checklist (clearly labelled in the UI). */
export function submitSelfReview(submissionId: number, checks: Record<string, boolean>, opts: { seconds?: number } = {}) {
  const { current, task, submission, drafts } = currentDraft(submissionId);
  if (wordCount(current.text) < 20) throw new Error("Write at least 20 words before reviewing.");
  const db = getDb();
  db.update(schema.writingDrafts).set({ selfReview: checks, feedbackSource: "checklist" }).where(eq(schema.writingDrafts.id, current.id)).run();
  db.update(schema.writingSubmissions).set({ status: drafts.length > 1 ? "revised" : "feedback", updatedAt: new Date() }).where(eq(schema.writingSubmissions.id, submissionId)).run();
  markUsedExpressions(current.text);
  recordWritingActivity(submission, task, current, opts.seconds);
}

export function deleteSubmission(id: number) {
  getDb().delete(schema.writingSubmissions).where(eq(schema.writingSubmissions.id, id)).run();
}
