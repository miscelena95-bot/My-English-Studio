import "server-only";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type Skill = "speaking" | "writing" | "grammar" | "vocabulary" | "reading" | "listening";
export type ActivityKind =
  | "vocab-review"
  | "vocab-practice"
  | "grammar-practice"
  | "grammar-task"
  | "writing"
  | "speaking"
  | "fluency"
  | "real-english"
  | "mistake-review"
  | "diagnostic"
  | "challenge";

export type Activity = typeof schema.activities.$inferSelect;

/** Upper bound on time credited to one activity, so a forgotten tab doesn't inflate stats. */
export const MAX_ACTIVITY_SECONDS = 45 * 60;

export async function startActivity(input: { kind: ActivityKind; skill: Skill; refId?: string | null; title: string; meta?: Record<string, unknown> }) {
  const row = await getDb()
    .insert(schema.activities)
    .values({ ...input, refId: input.refId ?? null, startedAt: new Date() })
    .returning({ id: schema.activities.id })
    .get();
  return row.id;
}

export async function getActivity(id: number) {
  return getDb().select().from(schema.activities).where(eq(schema.activities.id, id)).get();
}

/**
 * Complete an activity. Item counts come from recorded attempts when present,
 * so the stored score always matches what was actually answered.
 */
export async function completeActivity(id: number, input: { durationSec?: number; itemsTotal?: number; itemsCorrect?: number; meta?: Record<string, unknown> } = {}) {
  const db = getDb();
  const act = await getActivity(id);
  if (!act) throw new Error("Activity not found");
  const attempts = await db.select().from(schema.exerciseAttempts).where(eq(schema.exerciseAttempts.activityId, id)).all();
  const graded = attempts.filter((a) => a.isCorrect !== null);
  const now = new Date();
  const elapsed = Math.round((now.getTime() - act.startedAt.getTime()) / 1000);
  const duration = Math.min(MAX_ACTIVITY_SECONDS, Math.max(0, Math.min(input.durationSec ?? elapsed, elapsed)));
  await db
    .update(schema.activities)
    .set({
      completedAt: act.completedAt ?? now,
      durationSec: duration,
      itemsTotal: attempts.length ? graded.length : (input.itemsTotal ?? act.itemsTotal),
      itemsCorrect: attempts.length ? graded.filter((a) => a.isCorrect).length : (input.itemsCorrect ?? act.itemsCorrect),
      meta: { ...(act.meta ?? {}), ...(input.meta ?? {}) },
    })
    .where(eq(schema.activities.id, id))
    .run();
  return (await getActivity(id))!;
}

export async function completedActivitiesSince(since: Date) {
  return getDb()
    .select()
    .from(schema.activities)
    .where(and(isNotNull(schema.activities.completedAt), gte(schema.activities.startedAt, since)))
    .orderBy(desc(schema.activities.startedAt))
    .all();
}

export async function allCompletedActivities() {
  return getDb().select().from(schema.activities).where(isNotNull(schema.activities.completedAt)).orderBy(desc(schema.activities.startedAt)).all();
}

export async function recentActivities(limit = 10) {
  return getDb().select().from(schema.activities).where(isNotNull(schema.activities.completedAt)).orderBy(desc(schema.activities.completedAt)).limit(limit).all();
}

/** The most recent activity that was started but not finished (for "Continue"). */
export async function unfinishedActivity() {
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000);
  const rows = await getDb().select().from(schema.activities).where(gte(schema.activities.startedAt, since)).orderBy(desc(schema.activities.startedAt)).all();
  return rows.find((a) => !a.completedAt && a.kind !== "diagnostic");
}
