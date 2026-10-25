"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { endSession, generateReport, getHint, getSession, popUnansweredLearnerMessage, saveFollowUp, sendMessage, startSession, updateSessionSettings, deleteSessionTranscript } from "@/lib/server/speaking";
import { aiStatus } from "@/lib/ai";
import { run } from "./result";
import { productionFeedback } from "@/lib/server/feedback";
import { completeActivity, startActivity } from "@/lib/server/activity";
import { getDrill } from "@/content/speaking/scenarios";
import { markUsedExpressions } from "@/lib/server/vocabulary";

const StartSchema = z.object({
  scenarioId: z.string().min(1),
  correctionMode: z.enum(["fluency", "coaching", "precision"]),
  challenge: z.boolean(),
  inputMode: z.enum(["text", "voice"]),
  customTopic: z.string().trim().max(120).optional().nullable(),
});

export async function startConversation(formData: FormData) {
  if (!aiStatus().configured) redirect("/speaking?ai=missing");
  const input = StartSchema.parse({
    scenarioId: formData.get("scenarioId"),
    correctionMode: formData.get("correctionMode"),
    challenge: formData.get("challenge") === "on",
    inputMode: formData.get("inputMode") === "voice" ? "voice" : "text",
    customTopic: (formData.get("customTopic") as string) || null,
  });
  const s = startSession(input);
  redirect(`/speaking/${s.id}`);
}

export async function sendLearnerMessage(sessionId: number, text: string, inputMode: "typed" | "spoken", isRetry = false) {
  const r = await run(() => sendMessage(sessionId, text, { inputMode, isRetry }));
  if (!r.ok) {
    // Keep the transcript consistent: the learner's text is returned so they can resend it.
    const restored = popUnansweredLearnerMessage(sessionId);
    return { ...r, restored };
  }
  return { ok: true as const, data: { messages: r.data.messages } };
}

export async function requestHint(sessionId: number) {
  return run(() => getHint(sessionId));
}

export async function changeSessionSettings(sessionId: number, patch: { correctionMode?: "fluency" | "coaching" | "precision"; challengeMode?: boolean }) {
  return run(() => {
    updateSessionSettings(sessionId, patch);
    return true;
  });
}

export async function finishConversation(sessionId: number) {
  const r = await run(() => endSession(sessionId));
  revalidatePath("/", "layout");
  return r.ok ? { ok: true as const, data: { hasReport: !!r.data.report } } : r;
}

export async function retryReport(sessionId: number) {
  return run(async () => {
    const d = getSession(sessionId);
    if (!d?.report) await generateReport(sessionId);
    revalidatePath(`/speaking/${sessionId}`);
    return true;
  });
}

export async function submitFollowUp(sessionId: number, text: string, withFeedback: boolean) {
  return run(async () => {
    const used = saveFollowUp(sessionId, text);
    const d = getSession(sessionId)!;
    const report = d.report!.report as { followUpTask: { instruction: string; targetExpressions: string[] } };
    const feedback = withFeedback && aiStatus().configured
      ? await productionFeedback({ context: `Follow-up after the conversation “${d.session.title}”`, prompt: report.followUpTask.instruction, targets: report.followUpTask.targetExpressions, text, source: "speaking", sourceRef: `session:${sessionId}` })
      : null;
    return { used, feedback };
  });
}

export async function deleteConversation(sessionId: number) {
  deleteSessionTranscript(sessionId);
  revalidatePath("/", "layout");
  redirect("/speaking");
}

/** Fluency drill: store the result as a completed activity (with optional AI feedback). */
export async function submitFluencyDrill(input: { drillId: string; text: string; seconds: number; inputMode: "typed" | "spoken"; withFeedback: boolean }) {
  return run(async () => {
    const drill = getDrill(input.drillId);
    if (!drill) throw new Error("Unknown drill");
    const text = input.text.trim().slice(0, 4000);
    if (!text) throw new Error("There's no response to save yet.");
    const id = startActivity({ kind: "fluency", skill: "speaking", refId: drill.id, title: drill.title, meta: { inputMode: input.inputMode } });
    const used = markUsedExpressions(text).map((u) => u.phrase);
    const words = text.split(/\s+/).filter(Boolean).length;
    completeActivity(id, { durationSec: Math.max(input.seconds, 30) + 60, itemsTotal: 1, meta: { words, seconds: input.seconds, inputMode: input.inputMode } });
    const feedback =
      input.withFeedback && aiStatus().configured
        ? await productionFeedback({ context: `Fluency drill: ${drill.title}. ${drill.instruction}`, prompt: drill.prompt, targets: [...(drill.keywords ?? []), ...(drill.targets ?? [])], text, source: "speaking", sourceRef: `drill:${drill.id}`, inputMode: input.inputMode })
        : null;
    revalidatePath("/", "layout");
    return { words, used, feedback };
  });
}
