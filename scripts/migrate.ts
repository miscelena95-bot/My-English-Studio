import { databaseConfig, migrateDb } from "../src/lib/db";

const cfg = databaseConfig();
await migrateDb();
console.log(`Database is up to date: ${cfg.local ? cfg.url : cfg.url.replace(/\/\/.*@/, "//")}`);
