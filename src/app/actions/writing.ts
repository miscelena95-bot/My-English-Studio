"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSubmission, deleteSubmission, requestAIFeedback, saveDraft, startRevision, submitSelfReview } from "@/lib/server/writing";
import { run } from "./result";

export async function newSubmission(taskId: string) {
  const s = createSubmission(taskId);
  redirect(`/writing/s/${s.id}`);
}

export async function autosaveDraft(submissionId: number, text: string) {
  return run(() => {
    saveDraft(submissionId, text);
    return { savedAt: new Date().toISOString() };
  });
}

export async function getWritingFeedback(submissionId: number, text: string, seconds: number) {
  const r = await run(async () => {
    saveDraft(submissionId, text);
    return requestAIFeedback(submissionId, { seconds });
  });
  revalidatePath(`/writing/s/${submissionId}`);
  revalidatePath("/", "layout");
  return r;
}

export async function saveSelfReview(submissionId: number, text: string, checks: Record<string, boolean>, seconds: number) {
  const r = await run(() => {
    saveDraft(submissionId, text);
    submitSelfReview(submissionId, checks, { seconds });
    return true;
  });
  revalidatePath(`/writing/s/${submissionId}`);
  revalidatePath("/", "layout");
  return r;
}

export async function reviseDraft(submissionId: number) {
  const r = await run(() => startRevision(submissionId));
  revalidatePath(`/writing/s/${submissionId}`);
  return r.ok ? { ok: true as const, data: { version: r.data.version } } : r;
}

export async function removeSubmission(id: number) {
  deleteSubmission(id);
  revalidatePath("/writing");
  redirect("/writing");
}
