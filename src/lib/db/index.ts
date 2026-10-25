import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = LibSQLDatabase<typeof schema>;

/**
 * Database location:
 *  - DATABASE_URL (+ DATABASE_AUTH_TOKEN) — e.g. a Turso database: libsql://my-db.turso.io
 *  - otherwise DATABASE_PATH — a local SQLite file (default ./data/studio.db), or ":memory:"
 */
export function databaseConfig(env: Record<string, string | undefined> = process.env): { url: string; authToken?: string; local: boolean } {
  const url = env.DATABASE_URL?.trim();
  // On Vercel there is no persistent disk: a local file would silently lose every write.
  if (!url && env.VERCEL)
    throw new Error("DATABASE_URL is not set. On Vercel the app needs a hosted database (e.g. Turso): set DATABASE_URL and DATABASE_AUTH_TOKEN in the project's environment variables.");
  if (url) return { url, authToken: env.DATABASE_AUTH_TOKEN?.trim() || undefined, local: url === ":memory:" || url.startsWith("file:") };
  const file = env.DATABASE_PATH?.trim() || "./data/studio.db";
  if (file === ":memory:") return { url: ":memory:", local: true };
  return { url: `file:${path.resolve(file)}`, local: true };
}

const globalForDb = globalThis as unknown as { __studioDb?: DB; __studioClient?: Client };

export function getDb(): DB {
  if (!globalForDb.__studioDb) {
    const cfg = databaseConfig();
    if (cfg.url.startsWith("file:")) fs.mkdirSync(path.dirname(cfg.url.slice(5)), { recursive: true });
    const client = createClient({ url: cfg.url, authToken: cfg.authToken });
    globalForDb.__studioClient = client;
    globalForDb.__studioDb = drizzle(client, { schema });
  }
  return globalForDb.__studioDb;
}

/** Apply pending migrations (idempotent). */
export async function migrateDb(db: DB = getDb()) {
  // Local files: enforce foreign keys. The app also deletes child rows explicitly,
  // so it never depends on cascade settings (which may differ on remote databases).
  if (databaseConfig().local) await db.run("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

/** Test helper: start from a fresh, migrated in-memory database. */
export async function resetDbForTests(): Promise<DB> {
  globalForDb.__studioClient?.close();
  globalForDb.__studioDb = undefined;
  const db = getDb();
  await migrateDb(db);
  return db;
}

export { schema };
