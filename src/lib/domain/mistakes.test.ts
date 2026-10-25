import { describe, expect, it } from "vitest";
import { afterOccurrence, afterPractice, priorityScore, selectForReview, type MistakeLike } from "./mistakes";

const now = new Date("2026-03-10T10:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86400000);
let id = 0;
const m = (over: Partial<MistakeLike>): MistakeLike => ({
  id: ++id,
  category: "articles",
  severity: "error",
  occurrences: 1,
  status: "active",
  practiceCount: 0,
  consecutiveCorrect: 0,
  lastSeenAt: day(1),
  lastPracticedAt: null,
  ...over,
});

describe("mistake prioritisation", () => {
  it("ranks frequent, recent, important mistakes higher", () => {
    const frequent = m({ occurrences: 6, category: "verb-tense" });
    const rare = m({ occurrences: 1, category: "spelling", lastSeenAt: day(40) });
    expect(priorityScore(frequent, now)).toBeGreaterThan(priorityScore(rare, now));
  });
  it("boosts categories in the learner's current focus", () => {
    const a = m({ category: "prepositions" });
    expect(priorityScore(a, now, ["prepositions"])).toBeGreaterThan(priorityScore(a, now));
  });
  it("selects a manageable, varied set and skips style notes", () => {
    const items = [
      m({ category: "articles", occurrences: 9 }),
      m({ category: "articles", occurrences: 8 }),
      m({ category: "articles", occurrences: 7 }),
      m({ category: "prepositions", occurrences: 3 }),
      m({ category: "naturalness", severity: "style", occurrences: 20 }),
    ];
    const picked = selectForReview(items, 5, now);
    expect(picked.filter((x) => x.category === "articles")).toHaveLength(2);
    expect(picked.some((x) => x.severity === "style")).toBe(false);
    expect(picked).toHaveLength(3);
  });
  it("only re-checks resolved mistakes after a spacing interval", () => {
    const recent = m({ status: "resolved", lastPracticedAt: day(3) });
    const old = m({ status: "resolved", lastPracticedAt: day(30) });
    expect(selectForReview([recent, old], 5, now).map((x) => x.id)).toEqual([old.id]);
  });
});

describe("improvement tracking", () => {
  it("needs correct answers on two different days to resolve", () => {
    const a = m({});
    const first = afterPractice(a, true, now);
    expect(first.status).toBe("improving");
    const sameDay = afterPractice({ ...a, ...first, lastPracticedAt: now }, true, new Date(now.getTime() + 3600000));
    expect(sameDay.status).toBe("improving");
    const nextDay = afterPractice({ ...a, ...first, lastPracticedAt: now }, true, new Date(now.getTime() + 86400000));
    expect(nextDay.status).toBe("resolved");
  });
  it("resets after an incorrect answer and reactivates on a new occurrence", () => {
    expect(afterPractice(m({ consecutiveCorrect: 1, status: "improving" }), false, now).status).toBe("active");
    const r = afterOccurrence(m({ status: "resolved", occurrences: 2 }));
    expect(r).toMatchObject({ status: "active", occurrences: 3, regressed: true });
  });
});
