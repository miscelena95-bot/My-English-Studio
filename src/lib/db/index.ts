import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __studioDb?: DB; __studioSqlite?: Database.Database };

function open(): DB {
  const file = process.env.DATABASE_PATH || "./data/studio.db";
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Migrations are applied automatically so a fresh checkout works with `npm run dev`.
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  globalForDb.__studioSqlite = sqlite;
  return db;
}

export function getDb(): DB {
  if (!globalForDb.__studioDb) globalForDb.__studioDb = open();
  return globalForDb.__studioDb;
}

/** Test helper: start from an empty in-memory database. */
export function resetDbForTests(): DB {
  globalForDb.__studioSqlite?.close();
  globalForDb.__studioDb = undefined;
  return getDb();
}

export { schema };
