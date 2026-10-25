import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Free-tier daily quotas reset at midnight Pacific time, so usage is counted per Pacific day. */
export function quotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function recordAiRequest(model: string, now: Date = new Date()) {
  await getDb()
    .insert(schema.aiUsage)
    .values({ day: quotaDay(now), model, requests: 1 })
    .onConflictDoUpdate({ target: [schema.aiUsage.day, schema.aiUsage.model], set: { requests: sql`${schema.aiUsage.requests} + 1` } })
    .run();
}

/** Requests made today with each of the given models (0 for unused ones). */
export async function aiUsageToday(models: string[], now: Date = new Date()): Promise<{ model: string; requests: number }[]> {
  const day = quotaDay(now);
  const rows = await getDb().select().from(schema.aiUsage).where(eq(schema.aiUsage.day, day)).all();
  return models.map((model) => ({ model, requests: rows.find((r) => r.model === model)?.requests ?? 0 }));
}

