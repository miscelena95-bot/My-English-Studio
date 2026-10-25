import { describe, expect, it } from "vitest";
import { categoriseCorrection, normaliseCategory, patternKey } from "./mistake-categories";

describe("mistake categorisation", () => {
  it("normalises free-text labels", () => {
    expect(normaliseCategory("Verb tense (present perfect)")).toBe("verb-tense");
    expect(normaliseCategory("ARTICLES")).toBe("articles");
    expect(normaliseCategory("False friend")).toBe("vocabulary");
    expect(normaliseCategory("unnatural phrasing")).toBe("naturalness");
    expect(normaliseCategory("too informal for a client")).toBe("register");
    expect(normaliseCategory("something unknown")).toBe("grammar");
    expect(normaliseCategory(undefined)).toBe("grammar");
  });

  it("detects article errors", () => {
    expect(categoriseCorrection("The life in Genoa is expensive.", "Life in Genoa is expensive.")).toBe("articles");
    expect(categoriseCorrection("She is architect.", "She is an architect.")).toBe("articles");
  });
  it("detects preposition errors", () => {
    expect(categoriseCorrection("It depends of the budget.", "It depends on the budget.")).toBe("prepositions");
  });
  it("detects word order", () => {
    expect(categoriseCorrection("Can you tell me where is the venue?", "Can you tell me where the venue is?")).toBe("word-order");
  });
  it("detects tense", () => {
    expect(categoriseCorrection("I live here since 2015.", "I have lived here since 2015.")).toBe("verb-tense");
    expect(categoriseCorrection("Yesterday I have seen the client.", "Yesterday I saw the client.")).toBe("verb-tense");
  });
  it("detects spelling", () => {
    expect(categoriseCorrection("The meeting was very usefull.", "The meeting was very useful.")).toBe("spelling");
  });
  it("detects vocabulary choice", () => {
    expect(categoriseCorrection("I will assist to the conference.", "I will attend the conference.")).toBe("vocabulary");
  });

  it("creates stable pattern keys", () => {
    expect(patternKey("prepositions", "depend on", "x")).toBe("prepositions:depend-on");
    expect(patternKey("articles", null, "Life in Genoa is expensive.")).toBe(patternKey("articles", "", "life in genoa is expensive"));
  });
});
