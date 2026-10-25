import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Export all learning records as JSON (data portability). */
export function GET() {
  const db = getDb();
  const data = Object.fromEntries(
    Object.entries(schema)
      .filter(([, t]) => typeof t === "object" && t !== null && "getSQL" in (t as object))
      .map(([name, t]) => [name, db.select().from(t as typeof schema.activities).all()]),
  );
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), app: "My English Studio", data }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="my-english-studio-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
