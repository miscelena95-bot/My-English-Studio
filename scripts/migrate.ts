import { getDb } from "../src/lib/db";

getDb();
console.log("Database is up to date:", process.env.DATABASE_PATH || "./data/studio.db");
