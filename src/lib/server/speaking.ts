import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getScenario, type CorrectionMode, type Scenario } from "@/content/speaking/scenarios";
import { requireAI, getAIProvider } from "@/lib/ai";
import { ConversationReport, TutorTurn, type Correction } from "@/lib/ai/schemas";
import { reportSystemPrompt, tutorSystemPrompt } from "@/lib/ai/prompts";
import { validateCorrections, validateReport } from "@/lib/ai/validate";
import { canonical, wordCount } from "@/lib/domain/text";
import { completeActivity, startActivity } from "./activity";
import { buildLearnerContext, recyclableExpressions } from "./learner-context";
import { logMistake } from "./mistakes";
import { markUsedExpressions } from "./vocabulary";
import { getProfile } from "./profile";
import type { ChatTurn } from "@/lib/ai/provider";
import { z } from "zod";

export type Session = typeof schema.conversationSessions.$inferSelect;
export type Message = typeof schema.conversationMessages.$inferSelect;
export interface InlineFeedback {
  corrections: Correction[];
  hint: string | null;
  usedTargetExpressions: string[];
}

export const MAX_LEARNER_MESSAGE = 2000;

export function startSession(input: {
  scenarioId: string;
  correctionMode: CorrectionMode;
  challenge: boolean;
  inputMode: "text" | "voice";
  customTopic?: string | null;
}) {
  const scenario = getScenario(input.scenarioId);
  if (!scenario) throw new Error("Unknown scenario");
  // Recycle up to two expressions the learner is currently learning.
  const recycled = recyclableExpressions(6).filter((e) => !scenario.targetExpressions.some((t) => canonical(t) === canonical(e))).slice(0, 2);
  const targets = [...scenario.targetExpressions, ...recycled];
  const now = new Date();
  const activityId = startActivity({ kind: "speaking", skill: "speaking", refId: scenario.id, title: scenario.title, meta: { inputMode: input.inputMode } });
  const db = getDb();
  const session = db
    .insert(schema.conversationSessions)
    .values({
      scenarioId: scenario.id,
      title: input.customTopic ? `Free conversation: ${input.customTopic}` : scenario.title,
      category: scenario.category,
      inputMode: input.inputMode,
      correctionMode: input.correctionMode,
      challengeMode: input.challenge,
      customTopic: input.customTopic ?? null,
      targetExpressions: targets,
      startedAt: now,
      activityId,
    })
    .returning()
    .get();
  const opener = input.customTopic
    ? `Great — let's talk about ${input.customTopic}. What made you choose this topic?`
    : scenario.opener;
  db.insert(schema.conversationMessages).values({ sessionId: session.id, role: "tutor", content: opener, createdAt: now }).run();
  return session;
}

export function getSession(id: number) {
  const db = getDb();
  const session = db.select().from(schema.conversationSessions).where(eq(schema.conversationSessions.id, id)).get();
  if (!session) return undefined;
  const messages = db.select().from(schema.conversationMessages).where(eq(schema.conversationMessages.sessionId, id)).orderBy(asc(schema.conversationMessages.id)).all();
  const report = db.select().from(schema.conversationReports).where(eq(schema.conversationReports.sessionId, id)).orderBy(desc(schema.conversationReports.id)).get();
  return { session, messages, report, scenario: getScenario(session.scenarioId)! };
}

export function listSessions(limit = 20) {
  return getDb().select().from(schema.conversationSessions).orderBy(desc(schema.conversationSessions.startedAt)).limit(limit).all();
}

function historyFor(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = [{ role: "user", content: "(The role-play starts now. Your first line has already been shown to the learner.)" }];
  for (const m of messages) turns.push({ role: m.role === "learner" ? "user" : "assistant", content: m.content });
  return turns;
}

function limitCorrections(mode: string, list: Correction[]) {
  if (mode === "fluency") return [];
  if (mode === "coaching") return list.filter((c) => c.kind !== "style").slice(0, 1);
  return list.slice(0, 3);
}

/** Store the learner's message and get the tutor's reply. */
export async function sendMessage(sessionId: number, text: string, opts: { inputMode: "typed" | "spoken"; isRetry?: boolean }) {
  const data = getSession(sessionId);
  if (!data) throw new Error("Session not found");
  if (data.session.status !== "active") throw new Error("This conversation has ended.");
  const content = text.trim().slice(0, MAX_LEARNER_MESSAGE);
  if (!content) throw new Error("Write or say something first.");
  const db = getDb();
  db.insert(schema.conversationMessages).values({ sessionId, role: "learner", content, inputMode: opts.inputMode, isRetry: !!opts.isRetry }).run();
  db.update(schema.conversationSessions)
    .set({ learnerTurns: data.session.learnerTurns + 1, learnerWords: data.session.learnerWords + wordCount(content) })
    .where(eq(schema.conversationSessions.id, sessionId))
    .run();
  markUsedExpressions(content);

  const ai = requireAI();
  const fresh = getSession(sessionId)!;
  const turn = await ai.generate({
    task: "tutor-turn",
    system: tutorSystemPrompt({
      scenario: fresh.scenario,
      customTopic: fresh.session.customTopic,
      correctionMode: fresh.session.correctionMode as CorrectionMode,
      challenge: fresh.session.challengeMode,
      targetExpressions: fresh.session.targetExpressions,
      learner: buildLearnerContext(),
      inputMode: fresh.session.inputMode as "text" | "voice",
    }),
    messages: historyFor(fresh.messages),
    schema: TutorTurn,
    maxTokens: 3000,
    effort: "low",
  });
  const feedback: InlineFeedback = {
    corrections: limitCorrections(fresh.session.correctionMode, validateCorrections(turn.corrections, content, 3)),
    hint: fresh.session.challengeMode ? null : turn.hint,
    usedTargetExpressions: turn.usedTargetExpressions.filter((t) => fresh.session.targetExpressions.some((x) => canonical(x) === canonical(t))),
  };
  const reply = turn.reply.trim();
  if (!reply) throw new Error("The tutor returned an empty reply. Please try again.");
  db.insert(schema.conversationMessages).values({ sessionId, role: "tutor", content: reply, feedback }).run();
  return getSession(sessionId)!;
}

/** Remove the last learner message if the tutor failed to answer, so the learner can resend it. */
export function popUnansweredLearnerMessage(sessionId: number): string | null {
  const data = getSession(sessionId);
  const last = data?.messages[data.messages.length - 1];
  if (!data || !last || last.role !== "learner") return null;
  const db = getDb();
  db.delete(schema.conversationMessages).where(eq(schema.conversationMessages.id, last.id)).run();
  db.update(schema.conversationSessions)
    .set({ learnerTurns: Math.max(0, data.session.learnerTurns - 1), learnerWords: Math.max(0, data.session.learnerWords - wordCount(last.content)) })
    .where(eq(schema.conversationSessions.id, sessionId))
    .run();
  return last.content;
}

const HintSchema = z.object({
  hint: z.string().describe("A short hint to help the learner continue: an idea, a question to think about, or the start of a useful phrase. Never the full answer."),
  starters: z.array(z.string()).describe("2–3 sentence starters the learner could use next."),
});

export async function getHint(sessionId: number) {
  const data = getSession(sessionId);
  if (!data) throw new Error("Session not found");
  const db = getDb();
  db.update(schema.conversationSessions).set({ hintsUsed: data.session.hintsUsed + 1 }).where(eq(schema.conversationSessions.id, sessionId)).run();
  const ai = getAIProvider();
  if (!ai) {
    // Deterministic hint from the scenario itself — clearly not a tutor reply.
    return { source: "scenario" as const, hint: `Try to work towards: ${data.scenario.objectives[0]}.`, starters: data.session.targetExpressions.slice(0, 3) };
  }
  const h = await ai.generate({
    task: "tutor-hint",
    system: tutorSystemPrompt({
      scenario: data.scenario,
      customTopic: data.session.customTopic,
      correctionMode: "fluency",
      challenge: false,
      targetExpressions: data.session.targetExpressions,
      learner: buildLearnerContext(),
      inputMode: data.session.inputMode as "text" | "voice",
    }),
    messages: [...historyFor(data.messages), { role: "user", content: "(The learner pressed the Hint button. Help them continue without answering for them.)" }],
    schema: HintSchema,
    maxTokens: 1500,
    effort: "low",
  });
  return { source: "tutor" as const, hint: h.hint, starters: h.starters.slice(0, 3) };
}

export function updateSessionSettings(sessionId: number, patch: { correctionMode?: CorrectionMode; challengeMode?: boolean }) {
  getDb().update(schema.conversationSessions).set(patch).where(eq(schema.conversationSessions.id, sessionId)).run();
}

function learnerText(messages: Message[]) {
  return messages
    .filter((m) => m.role === "learner")
    .map((m) => m.content)
    .join("\n");
}

/** End the conversation and produce the feedback report (if AI is available). */
export async function endSession(sessionId: number) {
  const data = getSession(sessionId);
  if (!data) throw new Error("Session not found");
  const db = getDb();
  if (data.session.status === "active") {
    db.update(schema.conversationSessions).set({ status: "ended", endedAt: new Date() }).where(eq(schema.conversationSessions.id, sessionId)).run();
    if (data.session.activityId)
      completeActivity(data.session.activityId, {
        itemsTotal: data.session.learnerTurns,
        meta: { turns: data.session.learnerTurns, words: data.session.learnerWords, mode: data.session.correctionMode },
      });
  }
  if (data.report || data.session.learnerTurns === 0) return getSession(sessionId)!;
  await generateReport(sessionId);
  return getSession(sessionId)!;
}

export async function generateReport(sessionId: number) {
  const data = getSession(sessionId)!;
  const ai = requireAI();
  const text = learnerText(data.messages);
  const transcript = data.messages.map((m) => `${m.role === "learner" ? "LEARNER" : "PARTNER"}: ${m.content}`).join("\n");
  const raw = await ai.generate({
    task: "conversation-report",
    system: reportSystemPrompt({ scenario: data.scenario, targetExpressions: data.session.targetExpressions, learner: buildLearnerContext(), inputMode: data.session.inputMode as "text" | "voice" }),
    messages: [{ role: "user", content: `Full transcript:\n${transcript}\n\nThe learner's messages only (quote from these):\n${text}` }],
    schema: ConversationReport,
    maxTokens: 6000,
    effort: "medium",
  });
  const report = validateReport(raw, text);
  getDb().insert(schema.conversationReports).values({ sessionId, report }).run();

  // Log mistakes once: report corrections plus inline corrections not already covered.
  const inline = data.messages.flatMap((m) => ((m.feedback as InlineFeedback | null)?.corrections ?? []));
  const seen = new Set<string>();
  for (const c of [...report.corrections, ...inline]) {
    const k = canonical(c.original);
    if (seen.has(k) || c.kind === "style") continue;
    seen.add(k);
    logMistake({ original: c.original, corrected: c.corrected, explanation: c.explanation, category: c.category, severity: c.kind, source: "speaking", sourceRef: `session:${sessionId}`, context: data.scenario.title });
  }
  // Privacy preference: keep only the report, not the transcript.
  if (!getProfile().storeTranscripts) getDb().delete(schema.conversationMessages).where(eq(schema.conversationMessages.sessionId, sessionId)).run();
  return report;
}

export function saveFollowUp(sessionId: number, response: string) {
  const data = getSession(sessionId);
  if (!data?.report) throw new Error("No report for this session yet.");
  const used = markUsedExpressions(response);
  getDb()
    .update(schema.conversationReports)
    .set({ followUpDone: true, followUpResponse: response.slice(0, 3000) })
    .where(eq(schema.conversationReports.id, data.report.id))
    .run();
  return used.map((u) => u.phrase);
}

export function deleteSessionTranscript(sessionId: number) {
  getDb().delete(schema.conversationSessions).where(eq(schema.conversationSessions.id, sessionId)).run();
}

export type { Scenario };
