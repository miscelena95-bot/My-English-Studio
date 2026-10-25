import { describe, expect, it } from "vitest";
import { recommend, type RecInput } from "./recommendations";

const empty: RecInput = { mistakeCategories: [], topics: [], unusedNewExpressions: [], dueReviews: 0, aiConfigured: true };

describe("recommendations", () => {
  it("returns nothing without data (no fabricated advice)", () => {
    expect(recommend(empty)).toEqual([]);
  });
  it("schedules a contextual review for repeated article errors", () => {
    const r = recommend({ ...empty, mistakeCategories: [{ category: "articles", label: "Articles", active: 3, occurrences: 5, topicId: "articles-determiners" }] });
    expect(r[0]).toMatchObject({ id: "mistakes-articles", href: "/grammar/articles-determiners" });
    expect(r[0].reason).toContain("5 times");
  });
  it("prioritises speaking when a rule is known but not used spontaneously", () => {
    const r = recommend({
      ...empty,
      topics: [{ id: "conditionals", title: "Conditionals", attempts: 10, accuracy: 0.8, days: 3, flaggedForSpeaking: false, scenarioId: "pro-negotiate-supplier" }],
      mistakeCategories: [{ category: "grammar", label: "Grammar", active: 2, occurrences: 2, topicId: "conditionals" }],
    });
    expect(r.some((x) => x.id === "transfer-conditionals" && x.href.includes("pro-negotiate-supplier"))).toBe(true);
    expect(r.some((x) => x.id === "harder-conditionals")).toBe(false);
  });
  it("increases difficulty after consistent success and supports repeated struggle", () => {
    const r = recommend({
      ...empty,
      topics: [
        { id: "a", title: "A", attempts: 12, accuracy: 0.9, days: 3, flaggedForSpeaking: false, nextTopicId: "b" },
        { id: "c", title: "C", attempts: 8, accuracy: 0.25, days: 2, flaggedForSpeaking: false },
      ],
    });
    expect(r.map((x) => x.id)).toEqual(["support-c", "harder-a"]);
  });
  it("prompts the learner to use new expressions", () => {
    const r = recommend({ ...empty, unusedNewExpressions: [{ id: 1, phrase: "It turns out that" }] });
    expect(r[0].reason).toContain("It turns out that");
  });
});
