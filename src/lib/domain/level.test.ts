import { describe, expect, it } from "vitest";
import { estimateFromDiagnostic, levelFromScore, performanceSignal, weightedScore } from "./level";

describe("level estimation", () => {
  it("weights harder items more", () => {
    const easyOnly = weightedScore([
      { band: "B1", correct: true },
      { band: "C1", correct: false },
    ]);
    const hardOnly = weightedScore([
      { band: "B1", correct: false },
      { band: "C1", correct: true },
    ]);
    expect(hardOnly).toBeGreaterThan(easyOnly);
  });
  it("never claims C1 from a short quiz", () => {
    expect(levelFromScore(1)).toBe("B2+");
  });
  it("lists weak topics and evidence", () => {
    const r = estimateFromDiagnostic([
      { band: "B1", correct: true, topicId: "a" },
      { band: "B2", correct: false, topicId: "conditionals" },
      { band: "B2", correct: false, topicId: "conditionals" },
    ]);
    expect(r.weakTopics).toEqual(["conditionals"]);
    expect(r.evidence[0]).toBe("1 of 1 B1-level questions correct");
  });
  it("only signals a change with enough evidence", () => {
    expect(performanceSignal("B1+", { b2Accuracy: 0.9, b2Attempts: 10, speakingSessions: 5, writingWithFeedback: 5 })).toBeNull();
    expect(performanceSignal("B1+", { b2Accuracy: 0.9, b2Attempts: 40, speakingSessions: 5, writingWithFeedback: 5 })?.suggestUp).toBe(true);
    expect(performanceSignal("B1+", { b2Accuracy: 0.9, b2Attempts: 40, speakingSessions: 0, writingWithFeedback: 0 })?.suggestUp).toBe(false);
  });
});
