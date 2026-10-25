import { describe, expect, it } from "vitest";
import { gradeExercise } from "./grade";
import type { Exercise } from "./types";

const gap: Exercise = {
  id: "g1",
  type: "gap",
  text: "I ___ in Genoa since 2015.",
  answers: ["have lived", "have been living"],
  explanation: "Present perfect for a situation continuing up to now.",
};

describe("gap fill", () => {
  it("accepts every listed answer", () => {
    expect(gradeExercise(gap, { kind: "text", value: "have lived" }).status).toBe("correct");
    expect(gradeExercise(gap, { kind: "text", value: "have been living" }).status).toBe("correct");
  });
  it("accepts contractions and capitalisation", () => {
    expect(gradeExercise(gap, { kind: "text", value: "'ve lived" }).status).toBe("correct");
    expect(gradeExercise(gap, { kind: "text", value: "  Have Lived " }).status).toBe("correct");
    expect(gradeExercise(gap, { kind: "text", value: "’ve been living" }).status).toBe("correct");
  });
  it("rejects a wrong tense and explains", () => {
    const r = gradeExercise(gap, { kind: "text", value: "live" });
    expect(r.status).toBe("incorrect");
    expect(r.isCorrect).toBe(false);
    expect(r.correctSentence).toBe("I have lived in Genoa since 2015.");
    expect(r.learnerSentence).toBe("I live in Genoa since 2015.");
  });
  it("treats a one-letter typo in a long answer as close", () => {
    const r = gradeExercise(gap, { kind: "text", value: "have been livng" });
    expect(r.status).toBe("close");
    expect(r.isCorrect).toBe(true);
  });
  it("never treats a grammatical ending as a typo", () => {
    const t: Exercise = { id: "t", type: "transform", prompt: "", source: "", answers: ["The programme will be announced tomorrow."], explanation: "" };
    expect(gradeExercise(t, { kind: "text", value: "The programme will be announce tomorrow." }).status).toBe("incorrect");
    expect(gradeExercise(t, { kind: "text", value: "The programme will be anounced tomorrow." }).status).toBe("close");
    const g: Exercise = { id: "g", type: "gap", text: "She ___ in Milan.", answers: ["lives"], explanation: "" };
    expect(gradeExercise(g, { kind: "text", value: "live" }).status).toBe("incorrect");
  });
  it("does not treat a short wrong word as a typo", () => {
    const g2: Exercise = { id: "g2", type: "gap", text: "It depends ___ the weather.", answers: ["on"], explanation: "" };
    expect(gradeExercise(g2, { kind: "text", value: "of" }).status).toBe("incorrect");
    expect(gradeExercise(g2, { kind: "text", value: "" }).status).toBe("incorrect");
  });
});

describe("multiple choice", () => {
  const mcq: Exercise = {
    id: "m1",
    type: "mcq",
    prompt: "Choose the most natural option.",
    options: ["I'm agree.", "I agree.", "I am agree with you."],
    answer: 1,
    explanation: "'Agree' is a verb.",
    optionFeedback: { 0: "Italian 'sono d'accordo' leads to 'I'm agree'." },
  };
  it("grades the chosen index", () => {
    expect(gradeExercise(mcq, { kind: "choice", index: 1 }).isCorrect).toBe(true);
    const wrong = gradeExercise(mcq, { kind: "choice", index: 0 });
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.explanation).toContain("sono d'accordo");
  });
  it("supports several correct options", () => {
    const multi: Exercise = { ...mcq, answer: [1, 2] } as Exercise;
    expect(gradeExercise(multi, { kind: "choice", index: 2 }).isCorrect).toBe(true);
  });
});

describe("transform / correction with alternatives", () => {
  const tr: Exercise = {
    id: "t1",
    type: "transform",
    prompt: "Rewrite in the passive.",
    source: "They will announce the programme tomorrow.",
    answers: ["The programme will be announced tomorrow."],
    open: true,
    mustInclude: ["will be announced"],
    explanation: "will + be + past participle",
  };
  it("accepts the model answer regardless of punctuation", () => {
    expect(gradeExercise(tr, { kind: "text", value: "the programme will be announced tomorrow" }).status).toBe("correct");
  });
  it("never marks a plausible alternative as wrong", () => {
    const r = gradeExercise(tr, { kind: "text", value: "Tomorrow the programme will be announced." });
    expect(r.status).toBe("unverified");
    expect(r.isCorrect).toBeNull();
  });
  it("marks an answer missing the structure as incorrect", () => {
    const r = gradeExercise(tr, { kind: "text", value: "They announce the programme tomorrow." });
    expect(r.status).toBe("incorrect");
  });
  it("rejects an unchanged sentence in error correction", () => {
    const c: Exercise = {
      id: "c1",
      type: "correct",
      prompt: "Correct the mistake.",
      source: "I am agree with you.",
      answers: ["I agree with you."],
      explanation: "",
    };
    expect(gradeExercise(c, { kind: "text", value: "I am agree with you." }).message).toMatch(/still contains/);
    expect(gradeExercise(c, { kind: "text", value: "I agree with you" }).status).toBe("correct");
  });
  it("requires the keyword when one is given", () => {
    const k: Exercise = {
      id: "k1",
      type: "rephrase",
      prompt: "Use the expression.",
      source: "In my opinion, the venue is too small.",
      keyword: "as far as I'm concerned",
      answers: ["As far as I'm concerned, the venue is too small."],
      open: true,
      explanation: "",
    };
    expect(gradeExercise(k, { kind: "text", value: "As far as I am concerned, the venue is too small." }).status).toBe("correct");
    expect(gradeExercise(k, { kind: "text", value: "I think the venue is too small." }).status).toBe("incorrect");
    expect(gradeExercise(k, { kind: "text", value: "As far as I'm concerned, that venue is a bit small." }).status).toBe("unverified");
  });
});

describe("word order", () => {
  const o: Exercise = {
    id: "o1",
    type: "order",
    words: ["Could", "you", "tell", "me", "where", "the", "venue", "is"],
    answers: ["Could you tell me where the venue is?"],
    explanation: "Indirect questions use statement word order.",
  };
  it("grades sequences", () => {
    expect(gradeExercise(o, { kind: "order", sequence: ["Could", "you", "tell", "me", "where", "the", "venue", "is"] }).isCorrect).toBe(true);
    expect(gradeExercise(o, { kind: "order", sequence: ["Could", "you", "tell", "me", "where", "is", "the", "venue"] }).isCorrect).toBe(false);
  });
});

describe("match", () => {
  const m: Exercise = {
    id: "x",
    type: "match",
    prompt: "Match",
    pairs: [
      { left: "postpone", right: "move to a later date" },
      { left: "bring forward", right: "move to an earlier date" },
    ],
    explanation: "",
  };
  it("reports per-pair results", () => {
    const r = gradeExercise(m, { kind: "match", rightForLeft: ["move to a later date", "move to a later date"] });
    expect(r.pairResults).toEqual([true, false]);
    expect(r.isCorrect).toBe(false);
  });
});

describe("produce", () => {
  const p: Exercise = {
    id: "p",
    type: "produce",
    prompt: "Write a sentence about your work using the expression.",
    targets: ["run behind schedule"],
    modelAnswers: ["We're running behind schedule because the caterer arrived late."],
    explanation: "",
  };
  it("detects the expression with inflection and contractions", () => {
    expect(gradeExercise(p, { kind: "text", value: "Yesterday we ran a bit behind schedule at the conference." }).status).toBe("unverified");
    expect(gradeExercise(p, { kind: "text", value: "The setup is running behind schedule again today." }).status).toBe("unverified");
  });
  it("asks for the expression when missing", () => {
    expect(gradeExercise(p, { kind: "text", value: "We are late because the caterer arrived late." }).status).toBe("incorrect");
  });
  it("asks for a full sentence", () => {
    expect(gradeExercise(p, { kind: "text", value: "behind schedule" }).status).toBe("incorrect");
  });
});
