"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getProfile, updateProfile } from "@/lib/server/profile";
import { ProfileUpdateSchema, profileFromFormData } from "@/lib/validation/profile";
import { DIAGNOSTIC_ITEMS, DIAGNOSTIC_SPEAKING, DIAGNOSTIC_WRITING, SELF_ASSESSMENT_SKILLS } from "@/content/diagnostic";
import { gradeExercise } from "@/lib/exercises/grade";
import { estimateFromDiagnostic } from "@/lib/domain/level";
import { aiStatus } from "@/lib/ai";
import { productionFeedback } from "@/lib/server/feedback";
import { startActivity, completeActivity } from "@/lib/server/activity";
import { wordCount } from "@/lib/domain/text";
import { run } from "./result";

export type FormState = { ok: boolean; errors?: Record<string, string>; message?: string };

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function saveOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ProfileUpdateSchema.safeParse({ ...profileFromFormData(formData), showStreak: true, storeTranscripts: true, weeklyGoalMinutes: Number(formData.get("sessionMinutes") ?? 25) * 6, weeklyGoalSessions: 5 });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await updateProfile({ ...parsed.data, onboardingCompletedAt: new Date() });
  revalidatePath("/", "layout");
  redirect(formData.get("next") === "diagnostic" ? "/welcome/diagnostic" : "/");
}

export async function applyDefaults() {
  await updateProfile({ onboardingCompletedAt: new Date() });
  revalidatePath("/", "layout");
  redirect("/welcome/diagnostic");
}

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ProfileUpdateSchema.safeParse(profileFromFormData(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await updateProfile(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Your preferences have been saved." };
}

const DiagnosticSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(10)),
  writing: z.string().max(4000),
  speaking: z.string().max(4000),
  speakingMode: z.enum(["typed", "spoken"]),
  self: z.record(z.string(), z.number().int().min(1).max(5)),
  seconds: z.number().min(0).max(7200),
});

export async function submitDiagnostic(input: unknown) {
  return run(async () => {
    const d = DiagnosticSchema.parse(input);
    const graded = DIAGNOSTIC_ITEMS.map((item) => {
      const idx = d.answers[item.id];
      const correct = idx !== undefined && gradeExercise(item, { kind: "choice", index: idx }).isCorrect === true;
      return { item, idx, correct };
    });
    const est = estimateFromDiagnostic(graded.map((g) => ({ band: g.item.band, correct: g.correct, topicId: g.item.topicId })));

    let writingAssessment = null;
    let speakingAssessment = null;
    const evidence = [...est.evidence];
    if (aiStatus().configured) {
      if (wordCount(d.writing) >= DIAGNOSTIC_WRITING.minWords)
        writingAssessment = await productionFeedback({ context: "Initial diagnostic writing task", prompt: DIAGNOSTIC_WRITING.prompt, targets: [], text: d.writing, source: "writing", sourceRef: "diagnostic", askBand: true });
      if (wordCount(d.speaking) >= DIAGNOSTIC_SPEAKING.minWords)
        speakingAssessment = await productionFeedback({ context: "Initial diagnostic speaking task", prompt: DIAGNOSTIC_SPEAKING.prompt, targets: [], text: d.speaking, source: "speaking", sourceRef: "diagnostic", askBand: true, inputMode: d.speakingMode });
      if (writingAssessment?.estimatedBand) evidence.push(`Writing sample: tutor's rough impression ${writingAssessment.estimatedBand}`);
      if (speakingAssessment?.estimatedBand) evidence.push(`Speaking sample: tutor's rough impression ${speakingAssessment.estimatedBand}`);
    } else {
      evidence.push("Writing and speaking samples were saved but not assessed (AI tutor not configured).");
    }

    const answers: Record<string, string> = {};
    for (const g of graded) answers[g.item.id] = g.idx === undefined ? "" : g.item.options[g.idx];
    const grammar = graded.filter((g) => g.item.section === "grammar");
    const vocab = graded.filter((g) => g.item.section === "vocabulary");
    const self: Record<string, number> = {};
    for (const s of SELF_ASSESSMENT_SKILLS) if (d.self[s.id]) self[s.id] = d.self[s.id];

    await getDb()
      .insert(schema.diagnosticResults)
      .values({
        grammarCorrect: grammar.filter((g) => g.correct).length,
        grammarTotal: grammar.length,
        vocabCorrect: vocab.filter((g) => g.correct).length,
        vocabTotal: vocab.length,
        answers,
        writingSample: d.writing || null,
        writingAssessment,
        speakingSample: d.speaking || null,
        speakingAssessment,
        selfAssessment: self,
        estimatedLevel: est.level,
        weakTopics: est.weakTopics,
      })
      .run();
    await updateProfile({ estimatedLevel: est.level, levelEvidence: evidence, diagnosticCompletedAt: new Date() });
    const act = await startActivity({ kind: "diagnostic", skill: "grammar", refId: "diagnostic", title: "Initial diagnostic" });
    await completeActivity(act, { durationSec: d.seconds, itemsTotal: graded.length, itemsCorrect: graded.filter((g) => g.correct).length });
    revalidatePath("/", "layout");
    return { level: est.level, weakTopics: est.weakTopics, evidence };
  });
}

/** Privacy: remove stored conversation transcripts and writing (keeps aggregated progress). */
export async function deleteLearningRecords(kind: "transcripts" | "writing" | "everything") {
  const db = getDb();
  // Children first, explicitly: never depend on the database's cascade settings.
  if (kind === "transcripts" || kind === "everything") {
    await db.delete(schema.conversationMessages).run();
    await db.delete(schema.conversationReports).run();
    await db.delete(schema.conversationSessions).run();
  }
  if (kind === "writing" || kind === "everything") {
    await db.delete(schema.writingDrafts).run();
    await db.delete(schema.writingSubmissions).run();
  }
  if (kind === "everything") {
    for (const t of [schema.exerciseAttempts, schema.reviewLogs, schema.reviewSchedules, schema.vocabEntries, schema.mistakeEvents, schema.mistakes, schema.dailySessions, schema.contentProgress, schema.contentResources, schema.grammarProgress, schema.diagnosticResults, schema.progressSnapshots, schema.activities, schema.learnerProfile])
      await db.delete(t).run();
  }
  revalidatePath("/", "layout");
  if (kind === "everything") redirect("/welcome");
  return { ok: true };
}

export async function setBreak(until: string | null) {
  return run(async () => {
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Invalid date");
    await updateProfile({ breakUntil: until });
    revalidatePath("/", "layout");
    return (await getProfile()).breakUntil;
  });
}

export async function saveVoicePreference(voiceName: string | null, speechRate: number) {
  return run(async () => {
    await updateProfile({ voiceName: voiceName?.slice(0, 200) ?? null, speechRate: Math.min(1.4, Math.max(0.6, speechRate)) });
    return true;
  });
}
