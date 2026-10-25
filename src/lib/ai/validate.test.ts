import { describe, expect, it } from "vitest";
import { quotesSource, validateContentActivity, validateCorrections, validateReport } from "./validate";
import type { Correction } from "./schemas";

const learner = "Yesterday I have met the client and we discussed about the budget. It depends from the sponsor.";
const c = (o: Partial<Correction>): Correction => ({ original: "", corrected: "", explanation: "x", kind: "error", category: "grammar", ...o });

describe("AI output validation", () => {
  it("accepts quotes from the learner's text despite punctuation and case", () => {
    expect(quotesSource("yesterday I have met the client", learner)).toBe(true);
    expect(quotesSource("discussed about the budget.", learner)).toBe(true);
  });
  it("rejects invented quotes", () => {
    expect(quotesSource("I goed to the shop", learner)).toBe(false);
  });
  it("filters hallucinated, empty, duplicate and no-op corrections and normalises categories", () => {
    const out = validateCorrections(
      [
        c({ original: "I have met the client", corrected: "I met the client", category: "Tense" }),
        c({ original: "I goed home", corrected: "I went home" }),
        c({ original: "It depends from the sponsor", corrected: "It depends on the sponsor", category: "PREPOSITION" }),
        c({ original: "It depends from the sponsor", corrected: "It depends on the sponsor" }),
        c({ original: "the client", corrected: "the client" }),
        c({ original: "", corrected: "x" }),
      ],
      learner,
      5,
    );
    expect(out.map((x) => x.category)).toEqual(["verb-tense", "prepositions"]);
  });
  it("limits report sizes and dedupes expressions", () => {
    const r = validateReport(
      {
        summary: "s",
        strengths: ["a", "b", "c", "d"],
        corrections: [c({ original: "I have met the client", corrected: "I met the client" })],
        naturalAlternatives: [{ original: "invented sentence here", alternative: "x", note: "" }],
        usefulExpressions: Array.from({ length: 8 }, (_, i) => ({ phrase: i < 2 ? "It depends on" : `p${i}`, meaning: "m", example: "e" })),
        grammarPatterns: [],
        fluencyTip: "t",
        followUpTask: { instruction: "i", targetExpressions: [] },
      },
      learner,
    );
    expect(r.strengths).toHaveLength(3);
    expect(r.naturalAlternatives).toHaveLength(0);
    expect(r.usefulExpressions).toHaveLength(5);
    expect(r.usefulExpressions.filter((e) => e.phrase === "It depends on")).toHaveLength(1);
  });
  it("drops malformed comprehension questions", () => {
    const a = validateContentActivity({
      summary: "s",
      keyExpressions: [],
      discussionQuestions: [],
      productionTask: "p",
      comprehensionQuestions: [
        { question: "ok", options: ["a", "b", "c", "d"], answerIndex: 2, explanation: "" },
        { question: "bad index", options: ["a", "b", "c", "d"], answerIndex: 7, explanation: "" },
        { question: "dupes", options: ["a", "a", "b", "c"], answerIndex: 0, explanation: "" },
      ],
    });
    expect(a.comprehensionQuestions.map((q) => q.question)).toEqual(["ok"]);
  });
});
