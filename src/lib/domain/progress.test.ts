import { describe, expect, it } from "vitest";
import { activityMetrics, dayKey, skillIndicators, topicStats, weekStartKey, weeklyReflection, type ActivityLike, type AttemptLike } from "./progress";

const tz = "Europe/Rome";
// Wednesday 11 March 2026, 10:00 in Rome
const now = new Date("2026-03-11T09:00:00Z");
const daysAgo = (n: number, h = 10) => new Date(Date.UTC(2026, 2, 11 - n, h - 1));
const act = (n: number, minutes: number, skill = "grammar", kind = "grammar-practice"): ActivityLike => ({
  kind,
  skill,
  refId: null,
  startedAt: daysAgo(n),
  completedAt: daysAgo(n),
  durationSec: minutes * 60,
  itemsTotal: 0,
  itemsCorrect: 0,
});

describe("date helpers", () => {
  it("uses the studio timezone and Monday week starts", () => {
    expect(dayKey(new Date("2026-03-10T23:30:00Z"), tz)).toBe("2026-03-11");
    expect(weekStartKey(now, tz)).toBe("2026-03-09");
  });
});

describe("activity metrics", () => {
  it("sums only real completed activity time", () => {
    const m = activityMetrics([act(0, 10), act(0, 5), act(1, 20), act(5, 30), { ...act(0, 99), completedAt: null }], now);
    expect(m.minutesToday).toBe(15);
    expect(m.minutesThisWeek).toBe(35); // Mon 9 → today; 5 days ago is previous week
    expect(m.activeDaysThisWeek).toBe(2);
    expect(m.totalActivities).toBe(4);
    expect(m.last7.map((d) => d.minutes)).toEqual([0, 30, 0, 0, 0, 20, 15]);
  });
  it("computes streaks and doesn't penalise declared breaks", () => {
    expect(activityMetrics([act(0, 5), act(1, 5), act(2, 5), act(4, 5)], now).streak).toBe(3);
    expect(activityMetrics([act(1, 5), act(2, 5)], now).streak).toBe(2); // nothing today yet is OK
    expect(activityMetrics([act(0, 5), act(3, 5)], now, { breakUntil: "2026-03-10" }).streak).toBe(2);
    expect(activityMetrics([], now).streak).toBe(0);
  });
});

describe("skill indicators", () => {
  const att = (n: number, ok: boolean, skill = "grammar", topicId = "articles-determiners"): AttemptLike => ({ skill, topicId, isCorrect: ok, createdAt: daysAgo(n) });
  it("needs a minimum number of graded items", () => {
    const s = skillIndicators([], [att(1, true), att(1, false)], now).find((x) => x.skill === "grammar")!;
    expect(s.accuracy).toBeNull();
    expect(s.gradedItems).toBe(2);
  });
  it("computes accuracy and trend vs the previous window", () => {
    const attempts = [...Array(6)].map((_, i) => att(2, i < 5)).concat([...Array(6)].map((_, i) => att(40, i < 3)));
    const s = skillIndicators([], attempts, now).find((x) => x.skill === "grammar")!;
    expect(s.accuracy).toBeCloseTo(5 / 6);
    expect(s.trend).toBeCloseTo(5 / 6 - 0.5);
  });
  it("ignores unverified attempts", () => {
    const attempts = [...Array(5)].map(() => att(1, true)).concat([{ skill: "grammar", topicId: "x", isCorrect: null, createdAt: daysAgo(1) }]);
    expect(skillIndicators([], attempts, now).find((x) => x.skill === "grammar")!.gradedItems).toBe(5);
  });
  it("aggregates topic stats across days", () => {
    const t = topicStats([att(1, true), att(2, false), att(2, true)], "grammar", 60, now)[0];
    expect(t).toMatchObject({ topicId: "articles-determiners", attempts: 3, correct: 2, days: 2 });
  });
});

describe("weekly reflection", () => {
  it("derives statements from comparisons with last week", () => {
    const attempts: AttemptLike[] = [
      ...[0, 0, 0, 0].map((d, i) => ({ skill: "grammar", topicId: "t1", isCorrect: i < 4, createdAt: daysAgo(d) })),
      ...[7, 7, 7, 7].map((d, i) => ({ skill: "grammar", topicId: "t1", isCorrect: i < 2, createdAt: daysAgo(d) })),
    ];
    const r = weeklyReflection({
      now,
      activities: [act(0, 10, "speaking", "speaking")],
      attempts,
      mistakeEvents: [
        { category: "articles", type: "occurred", createdAt: daysAgo(8) },
        { category: "articles", type: "occurred", createdAt: daysAgo(9) },
        { category: "articles", type: "occurred", createdAt: daysAgo(0) },
      ],
      retainedExpressions: ["It turns out that"],
      topicTitle: (id) => id.toUpperCase(),
      categoryLabel: (c) => c,
    });
    expect(r.improved[0]).toContain("T1: 50% → 100%");
    expect(r.fewerErrors).toEqual([{ category: "articles", thisWeek: 1, lastWeek: 2 }]);
    expect(r.needsAttention).toContain("No writing practice yet this week");
    expect(r.hasData).toBe(true);
  });
});
