import "server-only";
import { desc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { categoriseCorrection, normaliseCategory, patternKey, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { afterOccurrence, afterPractice, selectForReview } from "@/lib/domain/mistakes";
import { canonical } from "@/lib/domain/text";

export type Mistake = typeof schema.mistakes.$inferSelect;

export interface MistakeInput {
  original: string;
  corrected: string;
  explanation: string;
  category?: string | null;
  pattern?: string | null;
  severity?: "error" | "unnatural" | "style";
  source: "grammar" | "vocabulary" | "speaking" | "writing" | "real-english" | "diagnostic";
  sourceRef?: string | null;
  context?: string | null;
  grammarTopicId?: string | null;
}

/**
 * Log a mistake. Repeated instances of the same pattern are grouped (and a
 * mistake that was resolved becomes active again), so frequency is real.
 */
export async function logMistake(input: MistakeInput): Promise<{ id: number; repeated: boolean }> {
  const db = getDb();
  const original = input.original.trim();
  const corrected = input.corrected.trim();
  if (!original || !corrected || canonical(original) === canonical(corrected)) return { id: -1, repeated: false };

  const category: MistakeCategory = input.category ? normaliseCategory(input.category) : categoriseCorrection(original, corrected);
  const key = patternKey(category, input.pattern, corrected);
  const now = new Date();
  const existing = await db.select().from(schema.mistakes).where(eq(schema.mistakes.patternKey, key)).get();

  if (existing) {
    const next = afterOccurrence(existing);
    await db
      .update(schema.mistakes)
      .set({
        occurrences: next.occurrences,
        status: next.status,
        consecutiveCorrect: next.consecutiveCorrect,
        lastSeenAt: now,
        resolvedAt: null,
        // Keep the most recent real example so practice uses the learner's latest sentence.
        original,
        corrected,
        explanation: input.explanation || existing.explanation,
        context: input.context ?? existing.context,
      })
      .where(eq(schema.mistakes.id, existing.id))
      .run();
    await db.insert(schema.mistakeEvents).values({ mistakeId: existing.id, type: next.regressed ? "regressed" : "occurred", text: original, source: input.source }).run();
    return { id: existing.id, repeated: true };
  }

  const row = await db
    .insert(schema.mistakes)
    .values({
      original,
      corrected,
      explanation: input.explanation,
      category,
      patternKey: key,
      severity: input.severity ?? "error",
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      context: input.context ?? null,
      grammarTopicId: input.grammarTopicId ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .returning({ id: schema.mistakes.id })
    .get();
  await db.insert(schema.mistakeEvents).values({ mistakeId: row.id, type: "occurred", text: original, source: input.source }).run();
  return { id: row.id, repeated: false };
}

export async function listMistakes(): Promise<Mistake[]> {
  return getDb().select().from(schema.mistakes).orderBy(desc(schema.mistakes.lastSeenAt)).all();
}

export async function getMistake(id: number) {
  const db = getDb();
  const m = await db.select().from(schema.mistakes).where(eq(schema.mistakes.id, id)).get();
  if (!m) return undefined;
  const events = await db.select().from(schema.mistakeEvents).where(eq(schema.mistakeEvents.mistakeId, id)).orderBy(desc(schema.mistakeEvents.createdAt)).all();
  return { ...m, events };
}

export async function activeMistakeCount() {
  const rows = await getDb().select().from(schema.mistakes).where(ne(schema.mistakes.status, "resolved")).all();
  return rows.filter((m) => m.severity !== "style").length;
}

export async function mistakesForReview(n = 5, focus: MistakeCategory[] = []) {
  return selectForReview(await listMistakes(), n, new Date(), focus);
}

export async function recordMistakePractice(id: number, correct: boolean, response: string) {
  const db = getDb();
  const m = await db.select().from(schema.mistakes).where(eq(schema.mistakes.id, id)).get();
  if (!m) return;
  const now = new Date();
  const next = afterPractice(m, correct, now);
  await db
    .update(schema.mistakes)
    .set({
      status: next.status,
      consecutiveCorrect: next.consecutiveCorrect,
      resolvedAt: next.resolvedAt,
      practiceCount: m.practiceCount + 1,
      practiceCorrect: m.practiceCorrect + (correct ? 1 : 0),
      lastPracticedAt: now,
    })
    .where(eq(schema.mistakes.id, id))
    .run();
  await db.insert(schema.mistakeEvents).values({ mistakeId: id, type: correct ? "practised-correct" : "practised-incorrect", text: response, source: "mistake-review" }).run();
  return next;
}

/** The learner disagrees that this was a mistake (e.g. a valid alternative). */
export async function dismissMistake(id: number) {
  await getDb().delete(schema.mistakeEvents).where(eq(schema.mistakeEvents.mistakeId, id)).run();
  await getDb().delete(schema.mistakes).where(eq(schema.mistakes.id, id)).run();
}

export async function categoryCounts() {
  const counts = new Map<string, { active: number; total: number; occurrences: number }>();
  for (const m of await listMistakes()) {
    const c = counts.get(m.category) ?? { active: 0, total: 0, occurrences: 0 };
    c.total++;
    c.occurrences += m.occurrences;
    if (m.status !== "resolved") c.active++;
    counts.set(m.category, c);
  }
  return counts;
}
