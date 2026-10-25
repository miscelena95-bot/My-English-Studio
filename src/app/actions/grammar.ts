"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getGrammarTopic } from "@/content/grammar";
import { aiStatus } from "@/lib/ai";
import { productionFeedback } from "@/lib/server/feedback";
import { completeActivity, startActivity } from "@/lib/server/activity";
import { markUsedExpressions } from "@/lib/server/vocabulary";
import { wordCount } from "@/lib/domain/text";
import { run } from "./result";

async function upsert(topicId: string, patch: Partial<typeof schema.grammarProgress.$inferInsert>) {
  await getDb()
    .insert(schema.grammarProgress)
    .values({ topicId, ...patch })
    .onConflictDoUpdate({ target: schema.grammarProgress.topicId, set: patch })
    .run();
}

export async function markLessonOpened(topicId: string) {
  return run(async () => {
    if (!getGrammarTopic(topicId)) throw new Error("Unknown topic");
    const existing = (await getDb().select().from(schema.grammarProgress).all()).find((p) => p.topicId === topicId);
    if (!existing?.lessonOpenedAt) await upsert(topicId, { lessonOpenedAt: new Date() });
    return true;
  });
}

export async function flagForSpeaking(topicId: string, flag: boolean) {
  return run(async () => {
    await upsert(topicId, { flaggedForSpeaking: flag });
    revalidatePath(`/grammar/${topicId}`);
    return flag;
  });
}

/** Communicative task: check locally that the target grammar was attempted, then (optionally) get tutor feedback. */
export async function submitGrammarTask(topicId: string, text: string, withFeedback: boolean, seconds: number) {
  return run(async () => {
    const topic = getGrammarTopic(topicId);
    if (!topic) throw new Error("Unknown topic");
    const clean = text.trim().slice(0, 3000);
    if (wordCount(clean) < Math.min(15, topic.task.minWords)) throw new Error(`Write at least ${Math.min(15, topic.task.minWords)} words.`);
    const lower = ` ${clean.toLowerCase()} `;
    const checks = topic.task.lookFor.map((l) => ({ label: l.label, found: l.anyOf.some((w) => lower.includes(w.toLowerCase())) }));
    await upsert(topicId, { taskResponse: clean, taskCompletedAt: new Date() });
    const act = await startActivity({ kind: "grammar-task", skill: "writing", refId: topicId, title: `${topic.title}: ${topic.task.title}` });
    await completeActivity(act, { durationSec: seconds, itemsTotal: 1 });
    await markUsedExpressions(clean);
    const feedback =
      withFeedback && aiStatus().configured
        ? await productionFeedback({ context: `Grammar Lab communicative task on “${topic.title}”. ${topic.objective}`, prompt: topic.task.prompt, targets: topic.task.lookFor.map((l) => l.label), text: clean, source: "grammar", sourceRef: `task:${topicId}` })
        : null;
    revalidatePath("/", "layout");
    return { checks, feedback, words: wordCount(clean) };
  });
}
