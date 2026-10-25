/**
 * Runs once per server instance, before requests are handled.
 * Local databases (a file, or in-memory) are migrated automatically so
 * `npm run dev` just works. Remote databases (Turso) are migrated at build
 * time by `npm run db:migrate` (see the vercel-build script), not on every cold start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { databaseConfig, migrateDb } = await import("@/lib/db");
  if (databaseConfig().local || process.env.DB_AUTO_MIGRATE === "1") await migrateDb();
}
