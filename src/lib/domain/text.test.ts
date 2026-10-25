import { describe, expect, it } from "vitest";
import { canonical, containsPhrase, wordCount } from "./text";

describe("text normalisation", () => {
  it("expands contractions consistently", () => {
    expect(canonical("I'm sure it's fine")).toBe(canonical("I am sure it is fine"));
    expect(canonical("We don't know")).toBe("we do not know");
    expect(canonical("She's finished")).toBe(canonical("she has finished"));
    expect(canonical("I can't")).toBe(canonical("I cannot"));
  });
  it("ignores punctuation and curly quotes", () => {
    expect(canonical("“Let’s go!”")).toBe(canonical("let us go"));
  });
  it("counts words", () => {
    expect(wordCount("  Hello there, how are you?  ")).toBe(5);
    expect(wordCount("")).toBe(0);
  });
  it("finds phrases with slots", () => {
    expect(containsPhrase("Would it be possible to move the meeting?", "Would it be possible to...?")).toBe(true);
    expect(containsPhrase("I see what you mean, but the cost is high.", "I see what you mean, but...")).toBe(true);
    expect(containsPhrase("It turned out that the hotel was full.", "it turns out that")).toBe(true);
    expect(containsPhrase("Let's get back to the main point.", "let's get back to the main point")).toBe(true);
    expect(containsPhrase("The point is clear.", "get back to the main point")).toBe(false);
  });
});
