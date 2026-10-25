import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { resetDbForTests, getDb, schema } from "@/lib/db";
import { setAIProviderForTests } from "@/lib/ai";
import { AIError, type AIProvider, type StructuredRequest } from "@/lib/ai/provider";
import { submitAnswer, settleAttempt } from "./exercises";
import { listMistakes, recordMistakePractice } from "./mistakes";
import { addSet, dueEntries, recordReview, markUsedExpressions, collectionStats } from "./vocabulary";
import { startSession, sendMessage, endSession, getSession, popUnansweredLearnerMessage } from "./speaking";
import { createSubmission, saveDraft, requestAIFeedback, startRevision, getSubmission, submitSelfReview } from "./writing";
import { startActivity, completeActivity } from "./activity";
import { dashboardData, buildPlan, progressData } from "./insights";
import { getProfile, updateProfile } from "./profile";

/** Stub provider: answers by schema shape, records requests. */
class StubAI implements AIProvider {
  id = "stub";
  model = "stub-model";
  requests: StructuredRequest<z.ZodType>[] = [];
  fail: AIError | null = null;
  async generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    this.requests.push(req);
    if (this.fail) throw this.fail;
    const keys = Object.keys((req.schema as unknown as { shape: Record<string, unknown> }).shape);
    if (keys.includes("reply"))
      return {
        reply: "Interesting. Why do you think so?",
        corrections: [
          { original: "depends from", corrected: "depends on", explanation: "depend on", kind: "error", category: "Preposition" },
          { original: "words never written", corrected: "x", explanation: "x", kind: "error", category: "grammar" },
        ],
        hint: null,
        usedTargetExpressions: ["The main reason is that ..."],
      } as z.infer<S>;
    if (keys.includes("fluencyTip"))
      return {
        summary: "Remote work.",
        strengths: ["Clear opinion."],
        corrections: [{ original: "It depends from the person", corrected: "It depends on the person", explanation: "depend on", kind: "error", category: "prepositions" }],
        naturalAlternatives: [],
        usefulExpressions: [{ phrase: "strike a balance", meaning: "find a compromise", example: "We need to strike a balance." }],
        grammarPatterns: [],
        fluencyTip: "Add examples.",
        followUpTask: { instruction: "Answer again.", targetExpressions: ["strike a balance"] },
      } as z.infer<S>;
    if (keys.includes("revisedVersion"))
      return {
        overall: "Good.",
        taskCompletion: { met: true, comment: "ok" },
        scores: { grammar: 3, vocabularyRange: 3, vocabularyAccuracy: 3, sentenceStructure: 3, coherence: 3, naturalness: 3, register: 3, taskCompletion: 3 },
        annotations: [
          { original: "In attachment you find", corrected: "Please find attached", explanation: "Natural phrase", kind: "error", category: "naturalness" },
          { original: "something she never wrote", corrected: "x", explanation: "x", kind: "error", category: "grammar" },
          { original: "Kind regards", corrected: "Best regards", explanation: "optional", kind: "style", category: "register" },
        ],
        priorities: ["a", "b", "c", "d"],
        naturalAlternatives: [],
        revisedVersion: "Revised",
        followUpTask: "Another email",
        progressNotes: [],
      } as z.infer<S>;
    throw new Error("unexpected schema " + keys.join(","));
  }
}

let ai: StubAI;
beforeEach(() => {
  resetDbForTests();
  ai = new StubAI();
  setAIProviderForTests(ai);
});

describe("exercise flow", () => {
  it("grades on the server, stores the attempt and logs a wrong answer as a mistake", () => {
    const r = submitAnswer({ exerciseId: "pr.i1", response: { kind: "text", value: "The number of tables depends from the final headcount." } });
    expect(r.grade.status).toBe("incorrect");
    const m = listMistakes();
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ category: "prepositions", patternKey: "prepositions:depend-on", original: "The number of tables depends from the final headcount." });
    // The same pattern again is grouped, not duplicated.
    submitAnswer({ exerciseId: "uncertainty.depends", response: { kind: "text", value: "from" } });
    expect(listMistakes()).toHaveLength(1);
    expect(listMistakes()[0].occurrences).toBe(2);
  });

  it("never auto-rejects an unverified answer; rejecting it logs the mistake", () => {
    const r = submitAnswer({ exerciseId: "pv.i1", response: { kind: "text", value: "Tomorrow the programme will be announced." } });
    expect(r.grade.status).toBe("unverified");
    expect(listMistakes()).toHaveLength(0);
    settleAttempt(r.attemptId, true);
    const a = getDb().select().from(schema.exerciseAttempts).all()[0];
    expect(a).toMatchObject({ status: "self-accepted", isCorrect: true });
    const r2 = submitAnswer({ exerciseId: "pv.i1", response: { kind: "text", value: "The programme will be announce tomorrow." } });
    expect(r2.grade.status).toBe("incorrect"); // missing "will be announced"
  });

  it("records mistake practice and resolves only after success on two days", () => {
    submitAnswer({ exerciseId: "pr.i1", response: { kind: "text", value: "It depends from the headcount." } });
    const id = listMistakes()[0].id;
    recordMistakePractice(id, true, "x");
    expect(listMistakes()[0].status).toBe("improving");
    getDb().update(schema.mistakes).set({ lastPracticedAt: new Date(Date.now() - 2 * 86400000) }).run();
    recordMistakePractice(id, true, "x");
    expect(listMistakes()[0].status).toBe("resolved");
  });

  it("rejects unknown exercise ids", () => {
    expect(() => submitAnswer({ exerciseId: "does-not-exist", response: { kind: "text", value: "x" } })).toThrow();
  });
});

describe("vocabulary flow", () => {
  it("adds a set, schedules reviews and updates the schedule after a review", () => {
    addSet("opinions");
    expect(collectionStats().total).toBe(8);
    expect(dueEntries()).toHaveLength(8);
    addSet("opinions"); // idempotent
    expect(collectionStats().total).toBe(8);
    const e = dueEntries()[0];
    const next = recordReview(e.id, { rating: "good", mode: "recall" });
    expect(next.intervalDays).toBe(1);
    expect(dueEntries().map((x) => x.id)).not.toContain(e.id);
    expect(getDb().select().from(schema.reviewLogs).all()).toHaveLength(1);
  });

  it("counts an expression as active when the learner uses it", () => {
    addSet("opinions");
    const used = markUsedExpressions("Well, as far as I'm concerned, the venue is perfect.");
    expect(used.map((u) => u.phrase)).toContain("As far as I'm concerned, ...");
    expect(collectionStats().usedActively).toBe(1);
  });
});

describe("speaking flow (with stub AI)", () => {
  it("runs a conversation, filters hallucinated corrections, and produces a report", async () => {
    const s = startSession({ scenarioId: "disc-remote-work", correctionMode: "coaching", challenge: false, inputMode: "text" });
    expect(getSession(s.id)!.messages).toHaveLength(1); // scene opener
    const after = await sendMessage(s.id, "I think it depends from the person, really.", { inputMode: "typed" });
    const tutor = after.messages[after.messages.length - 1];
    const fb = tutor.feedback as { corrections: Array<{ original: string; category: string }> };
    expect(fb.corrections).toEqual([expect.objectContaining({ original: "depends from", category: "prepositions" })]);
    // System prompt carries the mode and learner context.
    expect(ai.requests[0].system).toContain("COACHING MODE");
    expect(ai.requests[0].system).toContain("Genoa");
    const ended = await endSession(s.id);
    expect(ended.session.status).toBe("ended");
    expect(ended.report).toBeTruthy();
    expect(listMistakes().some((m) => m.source === "speaking" && m.category === "prepositions")).toBe(true);
    const act = getDb().select().from(schema.activities).all().find((a) => a.kind === "speaking")!;
    expect(act.completedAt).toBeTruthy();
  });

  it("fluency mode shows no inline corrections", async () => {
    const s = startSession({ scenarioId: "free-conversation", correctionMode: "fluency", challenge: false, inputMode: "voice" });
    const after = await sendMessage(s.id, "It depends from the weather.", { inputMode: "spoken" });
    expect((after.messages.at(-1)!.feedback as { corrections: unknown[] }).corrections).toEqual([]);
    expect(ai.requests[0].system).toContain("speech-to-text transcripts");
  });

  it("keeps the transcript consistent when the AI fails", async () => {
    const s = startSession({ scenarioId: "free-conversation", correctionMode: "fluency", challenge: false, inputMode: "text" });
    ai.fail = new AIError("busy", "rate-limit");
    await expect(sendMessage(s.id, "Hello there", { inputMode: "typed" })).rejects.toBeInstanceOf(AIError);
    expect(popUnansweredLearnerMessage(s.id)).toBe("Hello there");
    expect(getSession(s.id)!.messages).toHaveLength(1);
    expect(getSession(s.id)!.session.learnerTurns).toBe(0);
  });

  it("deletes transcripts after the report when the learner prefers", async () => {
    updateProfile({ storeTranscripts: false });
    const s = startSession({ scenarioId: "free-conversation", correctionMode: "fluency", challenge: false, inputMode: "text" });
    await sendMessage(s.id, "It depends from the person.", { inputMode: "typed" });
    const ended = await endSession(s.id);
    expect(ended.report).toBeTruthy();
    expect(ended.messages).toHaveLength(0);
  });
});

describe("writing flow", () => {
  it("saves drafts, validates AI feedback, tracks errors and supports revisions", async () => {
    const sub = createSubmission("w-schedule-change");
    saveDraft(sub.id, "Dear Mr Evans, In attachment you find the new programme for Friday. The tour is moved to the afternoon because of a private event. Kind regards, Elena");
    const fb = await requestAIFeedback(sub.id);
    expect(fb.annotations.map((a) => a.original)).toEqual(["In attachment you find", "Kind regards"]);
    expect(fb.priorities).toHaveLength(3);
    const logged = listMistakes().filter((m) => m.source === "writing");
    expect(logged).toHaveLength(1); // style suggestions are not tracked as mistakes
    expect(() => saveDraft(sub.id, "edit")).toThrow(/revision/);
    startRevision(sub.id);
    saveDraft(sub.id, "Dear Mr Evans, Please find attached the new programme for Friday. The tour has moved to the afternoon because of a private event. Kind regards, Elena");
    await requestAIFeedback(sub.id);
    const prompt = ai.requests.at(-1)!.messages[0].content;
    expect(prompt).toContain("PREVIOUS DRAFT (version 1)");
    expect(getSubmission(sub.id)!.drafts).toHaveLength(2);
    expect(getSubmission(sub.id)!.submission.status).toBe("revised");
  });

  it("offers an honest checklist review without AI", () => {
    setAIProviderForTests(null);
    const sub = createSubmission("w-free");
    saveDraft(sub.id, "Today I want to write about my weekend in Camogli with my family and some friends from work. It was really lovely and relaxing.");
    submitSelfReview(sub.id, { "The purpose is clear.": true });
    const d = getSubmission(sub.id)!.drafts[0];
    expect(d.feedbackSource).toBe("checklist");
    expect(d.feedback).toBeNull();
  });

  it("refuses AI feedback when not configured", async () => {
    setAIProviderForTests(null);
    const sub = createSubmission("w-free");
    saveDraft(sub.id, "word ".repeat(30));
    await expect(requestAIFeedback(sub.id)).rejects.toMatchObject({ kind: "not-configured" });
  });
});

describe("dashboard and planner use only real data", () => {
  it("shows zeros and no recommendations for a new learner", () => {
    const d = dashboardData();
    expect(d.hasHistory).toBe(false);
    expect(d.metrics.minutesThisWeek).toBe(0);
    expect(d.recommendations).toEqual([]);
    expect(d.skills.every((s) => s.accuracy === null)).toBe(true);
    expect(progressData().metrics.totalActivities).toBe(0);
  });

  it("reflects recorded activity and plans around due reviews and mistakes", () => {
    addSet("opinions");
    const id = startActivity({ kind: "grammar-practice", skill: "grammar", refId: "prepositions", title: "x" });
    for (const v of ["from", "of", "from"]) submitAnswer({ exerciseId: "uncertainty.depends", response: { kind: "text", value: v }, activityId: id });
    submitAnswer({ exerciseId: "problems.about", response: { kind: "text", value: "for" }, activityId: id });
    completeActivity(id, { durationSec: 300 });
    const d = dashboardData();
    expect(d.metrics.activitiesThisWeek).toBe(1);
    expect(d.vocab.due).toBe(8);
    const plan = buildPlan(25);
    expect(plan.steps[0].kind).toBe("vocab-review");
    expect(plan.steps.some((s) => s.kind === "mistake-review")).toBe(true);
    const act = getDb().select().from(schema.activities).all()[0];
    expect(act).toMatchObject({ itemsTotal: 4, itemsCorrect: 0 });
    expect(getProfile().sessionMinutes).toBe(25);
  });
});
