import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Export all learning records as JSON (data portability). */
export async function GET() {
  const db = getDb();
  const tables = Object.entries(schema).filter(([, t]) => typeof t === "object" && t !== null && "getSQL" in (t as object));
  const data = Object.fromEntries(await Promise.all(tables.map(async ([name, t]) => [name, await db.select().from(t as typeof schema.activities).all()] as const)));
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), app: "My English Studio", data }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="my-english-studio-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
