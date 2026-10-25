import { describe, expect, it } from "vitest";
import { newReviewState, nextReviewMode, scheduleReview, type ReviewState } from "./srs";

const DAY = 86400000;
const t0 = new Date("2026-01-01T09:00:00Z");
const at = (days: number) => new Date(t0.getTime() + days * DAY);

describe("spaced repetition", () => {
  it("schedules a first good recall for tomorrow", () => {
    const s = scheduleReview(newReviewState(t0), { rating: "good", mode: "recall", now: t0 });
    expect(s.intervalDays).toBe(1);
    expect(s.dueAt.getTime()).toBe(at(1).getTime());
    expect(s.repetitions).toBe(1);
  });

  it("grows intervals with successive successful recalls", () => {
    let s: ReviewState = newReviewState(t0);
    const intervals: number[] = [];
    let now = t0;
    for (let i = 0; i < 5; i++) {
      s = scheduleReview(s, { rating: "good", mode: "recall", now });
      intervals.push(s.intervalDays);
      now = s.dueAt;
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
  });

  it("resets and brings back a forgotten item within the same session", () => {
    let s = scheduleReview(newReviewState(t0), { rating: "good", mode: "recall", now: t0 });
    s = scheduleReview(s, { rating: "good", mode: "recall", now: at(1) });
    const f = scheduleReview(s, { rating: "forgotten", mode: "recall", now: at(4) });
    expect(f.repetitions).toBe(0);
    expect(f.lapses).toBe(1);
    expect(f.ease).toBeLessThan(s.ease);
    expect(f.dueAt.getTime() - at(4).getTime()).toBe(10 * 60 * 1000);
    expect(f.mastery).toBe("learning");
  });

  it("gives easy answers longer intervals than difficult ones", () => {
    const base = scheduleReview(scheduleReview(newReviewState(t0), { rating: "good", mode: "recall", now: t0 }), {
      rating: "good",
      mode: "recall",
      now: at(1),
    });
    const easy = scheduleReview(base, { rating: "easy", mode: "recall", now: at(4) });
    const hard = scheduleReview(base, { rating: "difficult", mode: "recall", now: at(4) });
    expect(easy.intervalDays).toBeGreaterThan(hard.intervalDays);
    expect(hard.ease).toBeLessThan(easy.ease);
  });

  it("gives less credit for recognition than for independent recall", () => {
    const base = scheduleReview(newReviewState(t0), { rating: "good", mode: "recall", now: t0 });
    const rec = scheduleReview(base, { rating: "good", mode: "recognition", now: at(1) });
    const prod = scheduleReview(base, { rating: "good", mode: "production", now: at(1) });
    expect(rec.intervalDays).toBeLessThan(prod.intervalDays);
    expect(rec.successfulRecalls).toBe(base.successfulRecalls);
  });

  it("credits late but successful reviews", () => {
    let s = scheduleReview(newReviewState(t0), { rating: "good", mode: "recall", now: t0 });
    s = scheduleReview(s, { rating: "good", mode: "recall", now: at(1) }); // interval 3
    const onTime = scheduleReview(s, { rating: "good", mode: "recall", now: at(4) });
    const late = scheduleReview(s, { rating: "good", mode: "recall", now: at(14) });
    expect(late.intervalDays).toBeGreaterThan(onTime.intervalDays);
  });

  it("marks long-interval independently recalled items as mastered, and caps intervals", () => {
    let s = newReviewState(t0);
    let now = t0;
    for (let i = 0; i < 12; i++) {
      s = scheduleReview(s, { rating: "easy", mode: "production", now });
      now = s.dueAt;
    }
    expect(s.mastery).toBe("mastered");
    expect(s.intervalDays).toBeLessThanOrEqual(180);
  });

  it("chooses harder exercise modes as items mature", () => {
    expect(nextReviewMode({ mastery: "new", repetitions: 0, lapses: 0 })).toBe("recognition");
    expect(nextReviewMode({ mastery: "learning", repetitions: 1, lapses: 0 })).toBe("recall");
    expect(nextReviewMode({ mastery: "reviewing", repetitions: 4, lapses: 0 })).toBe("production");
  });
});
