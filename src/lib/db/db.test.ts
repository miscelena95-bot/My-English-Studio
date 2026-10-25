import { describe, expect, it } from "vitest";
import { databaseConfig } from "./index";

describe("database configuration", () => {
  it("uses a remote libSQL URL with its token", () => {
    expect(databaseConfig({ DATABASE_URL: "libsql://studio-me.turso.io", DATABASE_AUTH_TOKEN: "t" })).toEqual({ url: "libsql://studio-me.turso.io", authToken: "t", local: false });
  });
  it("falls back to a local file, or memory", () => {
    const c = databaseConfig({ DATABASE_PATH: "./data/x.db" });
    expect(c.local).toBe(true);
    expect(c.url).toMatch(/^file:\/.*data\/x\.db$/);
    expect(databaseConfig({ DATABASE_PATH: ":memory:" })).toEqual({ url: ":memory:", local: true });
  });
  it("refuses to use a local file on Vercel", () => {
    expect(() => databaseConfig({ VERCEL: "1" })).toThrow(/DATABASE_URL is not set/);
  });
});
