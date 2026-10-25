import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { aiStatus, getAIProvider } from "@/lib/ai";
import { aiUsageToday, quotaDay, recordAiRequest } from "./ai-usage";

describe("AI usage counter", () => {
  beforeEach(async () => {
    await resetDbForTests();
  });

  it("counts by Pacific-time day, which is when free quotas reset", () => {
    // 08:30 in Italy (CET) is still the previous day in California.
    expect(quotaDay(new Date("2026-01-15T07:30:00Z"))).toBe("2026-01-14");
    expect(quotaDay(new Date("2026-01-15T08:30:00Z"))).toBe("2026-01-15");
  });

  it("counts requests per model and day", async () => {
    const now = new Date("2026-10-25T12:00:00Z");
    await recordAiRequest("a", now);
    await recordAiRequest("a", now);
    await recordAiRequest("b", now);
    await recordAiRequest("a", new Date("2026-10-26T12:00:00Z"));
    expect(await aiUsageToday(["a", "b", "c"], now)).toEqual([
      { model: "a", requests: 2 },
      { model: "b", requests: 1 },
      { model: "c", requests: 0 },
    ]);
  });
});

describe("provider selection", () => {
  afterEach(() => vi.unstubAllEnvs());
  const env = (vars: Record<string, string>) => {
    for (const k of ["AI_PROVIDER", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_MODEL", "AI_FALLBACK_MODEL", "AI_DAILY_LIMIT"]) vi.stubEnv(k, vars[k] ?? "");
  };

  it("uses Gemini when only a Gemini key is set, with the free-tier fallback model", () => {
    env({ GEMINI_API_KEY: "g" });
    const s = aiStatus();
    expect(s).toMatchObject({ configured: true, provider: "gemini", model: "gemini-3.8-flash", quota: { models: ["gemini-3.8-flash", "gemini-3.6-flash"], perModelLimit: 20 } });
  });

  it("prefers Anthropic when both keys are set, unless AI_PROVIDER says otherwise", () => {
    env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect(getAIProvider()?.id).toBe("anthropic");
    expect(aiStatus().quota).toBeNull();
    env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", AI_PROVIDER: "gemini" });
    expect(getAIProvider()?.id).toBe("gemini");
  });

  it("honours AI_FALLBACK_MODEL=none and AI_DAILY_LIMIT", () => {
    env({ GEMINI_API_KEY: "g", AI_FALLBACK_MODEL: "none", AI_DAILY_LIMIT: "50" });
    expect(aiStatus().quota).toEqual({ models: ["gemini-3.8-flash"], perModelLimit: 50 });
  });

  it("is not configured without a key", () => {
    env({});
    expect(aiStatus().configured).toBe(false);
  });
});
