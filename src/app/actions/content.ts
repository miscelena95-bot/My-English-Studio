"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getUnit } from "@/content/real-english";
import { aiStatus, requireAI } from "@/lib/ai";
import { ContentActivity } from "@/lib/ai/schemas";
import { contentActivitySystemPrompt } from "@/lib/ai/prompts";
import { validateContentActivity } from "@/lib/ai/validate";
import { productionFeedback } from "@/lib/server/feedback";
import { completeActivity, startActivity } from "@/lib/server/activity";
import { markUsedExpressions } from "@/lib/server/vocabulary";
import { wordCount } from "@/lib/domain/text";
import { run } from "./result";

export async function saveUnitStep(unitId: string, step: string, answer?: string) {
  return run(() => {
    if (!getUnit(unitId)) throw new Error("Unknown unit");
    const db = getDb();
    const p = db.select().from(schema.contentProgress).where(eq(schema.contentProgress.contentId, unitId)).get();
    if (!p) {
      db.insert(schema.contentProgress).values({ contentId: unitId, startedAt: new Date(), stepsDone: [step], answers: answer ? { [step]: answer } : {} }).run();
    } else {
      db.update(schema.contentProgress)
        .set({ stepsDone: Array.from(new Set([...p.stepsDone, step])), answers: answer ? { ...p.answers, [step]: answer.slice(0, 3000) } : p.answers })
        .where(eq(schema.contentProgress.contentId, unitId))
        .run();
    }
    return true;
  });
}

export async function submitUnitProduction(unitId: string, text: string, withFeedback: boolean, seconds: number, inputMode: "typed" | "spoken") {
  return run(async () => {
    const unit = getUnit(unitId);
    if (!unit) throw new Error("Unknown unit");
    const clean = text.trim().slice(0, 4000);
    if (wordCount(clean) < 15) throw new Error("Write or say at least 15 words.");
    const db = getDb();
    db.update(schema.contentProgress).set({ completedAt: new Date() }).where(eq(schema.contentProgress.contentId, unitId)).run();
    const act = startActivity({ kind: "real-english", skill: unit.skill, refId: unit.id, title: unit.title });
    completeActivity(act, { durationSec: seconds, itemsTotal: 1, meta: { inputMode } });
    const used = markUsedExpressions(clean).map((u) => u.phrase);
    const feedback =
      withFeedback && aiStatus().configured
        ? await productionFeedback({ context: `Real English unit “${unit.title}”. Objective: ${unit.objective}`, prompt: unit.production.prompt, targets: unit.production.targets, text: clean, source: "real-english", sourceRef: unit.id, inputMode })
        : null;
    revalidatePath("/", "layout");
    return { used, feedback };
  });
}

const ResourceSchema = z.object({
  title: z.string().trim().min(3, "Add a title.").max(200),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https?:\/\//.test(v), "The link must start with http:// or https://"),
  kind: z.enum(["article", "video", "podcast", "book", "song", "other"]),
  notes: z.string().trim().max(4000).optional().transform((v) => v || null),
});

/** Learner-added resources (articles, podcasts, videos). Text pasted by the learner is used to build an activity. */
export async function addResource(input: unknown) {
  return run(() => {
    const r = ResourceSchema.parse(input);
    const row = getDb().insert(schema.contentResources).values({ kind: r.kind, title: r.title, url: r.url, learnerNotes: r.notes }).returning().get();
    revalidatePath("/real-english");
    return row.id;
  });
}

export async function deleteResource(id: number) {
  return run(() => {
    getDb().delete(schema.contentResources).where(eq(schema.contentResources.id, id)).run();
    revalidatePath("/real-english");
    return true;
  });
}

/** Build a learning activity from text the learner provides or from a cached news item — never from invented content. */
export async function generateActivityForResource(id: number) {
  return run(async () => {
    const db = getDb();
    const r = db.select().from(schema.contentResources).where(eq(schema.contentResources.id, id)).get();
    if (!r) throw new Error("Resource not found");
    const text = [r.summary, r.sourceText, r.learnerNotes].filter(Boolean).join("\n\n");
    if (wordCount(text) < 25) throw new Error("Paste at least a paragraph of text (or your own notes about it) so the activity is based on real content.");
    const ai = requireAI();
    const raw = await ai.generate({
      task: "content-activity",
      system: contentActivitySystemPrompt(),
      messages: [{ role: "user", content: `Title: ${r.title}\nSource: ${r.sourceName ?? r.url ?? "provided by the learner"}${r.publishedAt ? `\nPublished: ${r.publishedAt}` : ""}\n\nText:\n${text}` }],
      schema: ContentActivity,
      maxTokens: 5000,
      effort: "low",
    });
    const activity = validateContentActivity(raw);
    db.update(schema.contentResources).set({ generatedActivity: activity }).where(eq(schema.contentResources.id, id)).run();
    revalidatePath(`/real-english/resources/${id}`);
    return activity;
  });
}

export async function completeResourceActivity(id: number, text: string, seconds: number, withFeedback: boolean) {
  return run(async () => {
    const db = getDb();
    const r = db.select().from(schema.contentResources).where(eq(schema.contentResources.id, id)).get();
    if (!r) throw new Error("Resource not found");
    const clean = text.trim().slice(0, 4000);
    if (wordCount(clean) < 15) throw new Error("Write at least 15 words.");
    const act = startActivity({ kind: "real-english", skill: "reading", refId: `resource:${id}`, title: r.title });
    completeActivity(act, { durationSec: seconds, itemsTotal: 1 });
    const used = markUsedExpressions(clean).map((u) => u.phrase);
    const activity = r.generatedActivity as { productionTask?: string } | null;
    const feedback =
      withFeedback && aiStatus().configured
        ? await productionFeedback({ context: `Response to “${r.title}”`, prompt: activity?.productionTask ?? "Respond to the article.", targets: [], text: clean, source: "real-english", sourceRef: `resource:${id}` })
        : null;
    revalidatePath("/", "layout");
    return { used, feedback };
  });
}
