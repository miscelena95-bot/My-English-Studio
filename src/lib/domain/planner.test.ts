import { describe, expect, it } from "vitest";
import { chooseFocus, planDailySession, stepCompletion, type PlannerInput } from "./planner";

const base: PlannerInput = {
  minutes: 25,
  aiConfigured: true,
  dueReviews: 7,
  topMistake: { label: "Articles", count: 4 },
  activeMistakes: 5,
  weakTopic: null,
  daysSinceSpeaking: 2,
  daysSinceWriting: 1,
  lesson: null,
  fallbackScenario: { id: "disc-remote-work", title: "Remote work", objective: "Give an opinion with two reasons." },
  fallbackWriting: { id: "w-free", title: "Free writing", objective: "Write freely." },
  fallbackDrill: { id: "fl-weekend", title: "30-second answer" },
  content: { id: "travel-genoa-caruggi", title: "Caruggi", objective: "Describe a place." },
  newSet: { id: "opinions", title: "Opinions" },
};

describe("daily session planner", () => {
  it("builds a balanced 25-minute session with reasons", () => {
    const p = planDailySession(base);
    expect(p.steps.map((s) => s.kind)).toEqual(["vocab-review", "mistake-review", "speaking", "real-english", "reflection"]);
    expect(p.steps.reduce((s, x) => s + x.minutes, 0)).toBe(25);
    expect(p.steps.every((s) => s.reason.length > 10)).toBe(true);
    expect(p.why.join(" ")).toMatch(/speaking for 2 days/);
  });
  it("offers a short 10-minute version", () => {
    const p = planDailySession({ ...base, minutes: 10 });
    expect(p.minutes).toBe(10);
    expect(p.steps.reduce((s, x) => s + x.minutes, 0)).toBeLessThanOrEqual(12);
    expect(p.steps.some((s) => s.kind === "real-english")).toBe(false);
  });
  it("adds the other production skill in extended sessions", () => {
    const p = planDailySession({ ...base, minutes: 40 });
    expect(p.steps.some((s) => s.kind === "speaking") && p.steps.some((s) => s.kind === "writing")).toBe(true);
  });
  it("gives writing a turn when neglected", () => {
    expect(chooseFocus({ daysSinceSpeaking: 0, daysSinceWriting: 4 })).toBe("writing");
    expect(chooseFocus({ daysSinceSpeaking: 3, daysSinceWriting: 4 })).toBe("speaking");
  });
  it("uses an honest offline fallback for speaking without AI", () => {
    const p = planDailySession({ ...base, aiConfigured: false });
    const s = p.steps.find((x) => x.kind === "fluency")!;
    expect(s.reason).toMatch(/isn't configured/);
  });
  it("follows the learning path when there is a next lesson", () => {
    const p = planDailySession({
      ...base,
      dueReviews: 0,
      activeMistakes: 0,
      topMistake: null,
      lesson: { id: "l-disagree", title: "Disagree diplomatically", objective: "Disagree without sounding rude.", vocabSetId: "disagreeing", grammarTopicId: "modal-verbs", grammarTitle: "Modals", scenarioId: "pro-meeting-disagree", scenarioTitle: "Meeting" },
    });
    expect(p.mission).toBe("Disagree diplomatically");
    expect(p.steps[0]).toMatchObject({ kind: "vocab-learn", match: { refId: "disagreeing" } });
    expect(p.steps.find((s) => s.kind === "speaking")!.href).toContain("pro-meeting-disagree");
  });
  it("marks steps complete from real activities", () => {
    const p = planDailySession(base);
    const done = stepCompletion(p.steps, [{ kind: "vocab-review", refId: null, completedAt: new Date() }, { kind: "speaking", refId: "x", completedAt: null }], false);
    expect(done).toEqual([true, false, false, false, false]);
  });
});
