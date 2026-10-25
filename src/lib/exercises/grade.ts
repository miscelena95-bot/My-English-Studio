import { canonical, containsPhrase, levenshtein, normaliseQuotes, sameVerbFamily, stem, wordCount, words } from "@/lib/domain/text";
import type { Exercise, ExerciseResponse, GradeResult } from "./types";

/**
 * Deterministic grading. No network calls: objective items are always graded
 * locally. Open items that can't be verified locally are returned as
 * "unverified" — never "incorrect" — so valid alternatives are not rejected.
 */
export function gradeExercise(ex: Exercise, res: ExerciseResponse): GradeResult {
  switch (ex.type) {
    case "mcq":
      return gradeMcq(ex, res);
    case "gap":
      return gradeGap(ex, res);
    case "match":
      return gradeMatch(ex, res);
    case "order":
      return gradeOrder(ex, res);
    case "transform":
    case "correct":
    case "rephrase":
    case "formality":
      return gradeTransform(ex, res);
    case "produce":
      return gradeProduce(ex, res);
  }
}

function textOf(res: ExerciseResponse): string {
  if (res.kind === "text") return res.value;
  if (res.kind === "order") return res.sequence.join(" ");
  return "";
}

/**
 * Accept a spelling slip only when exactly one word differs by a letter or two,
 * and the difference isn't grammatical (announce/announced, live/lives).
 */
export function isTypo(given: string, expected: string): boolean {
  const g = words(given);
  const e = words(expected);
  if (g.length !== e.length || canonical(given) === canonical(expected)) return false;
  const diffs = g.map((w, i) => [w, e[i]] as const).filter(([a, b]) => a !== b);
  if (diffs.length !== 1) return false;
  const [a, b] = diffs[0];
  if (b.length < 5 || sameVerbFamily(a, b) || stem(a) === stem(b)) return false;
  const d = levenshtein(a, b);
  return d === 1 || (b.length >= 9 && d === 2);
}

function gradeMcq(ex: Extract<Exercise, { type: "mcq" }>, res: ExerciseResponse): GradeResult {
  const correct = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
  const idx = res.kind === "choice" ? res.index : -1;
  const ok = correct.includes(idx);
  const extra = idx >= 0 ? ex.optionFeedback?.[idx] : undefined;
  return {
    status: ok ? "correct" : "incorrect",
    isCorrect: ok,
    expected: correct.map((i) => ex.options[i]),
    message: ok ? "Correct." : `Not quite — the best answer is “${ex.options[correct[0]]}”.`,
    explanation: extra ? `${extra} ${ex.explanation}` : ex.explanation,
    learnerSentence: idx >= 0 ? ex.options[idx] : undefined,
    correctSentence: ex.options[correct[0]],
  };
}

export function fillGap(text: string, value: string): string {
  const v = normaliseQuotes(value.trim());
  // "I ___" + "'ve lived" → "I've lived"
  return v.startsWith("'") ? text.replace(/\s?___/, v) : text.replace("___", v);
}

function gradeGap(ex: Extract<Exercise, { type: "gap" }>, res: ExerciseResponse): GradeResult {
  const given = textOf(res).trim();
  const base = {
    expected: ex.answers,
    explanation: ex.explanation,
    learnerSentence: fillGap(ex.text, given || "…"),
    correctSentence: fillGap(ex.text, ex.answers[0]),
  };
  if (!given) return { ...base, status: "incorrect", isCorrect: false, message: "No answer given." };
  // Compare the whole sentence so that "I'm"/"I am" style variation in the gap is accepted.
  const filled = canonical(fillGap(ex.text, given));
  if (ex.answers.some((a) => canonical(fillGap(ex.text, a)) === filled))
    return { ...base, status: "correct", isCorrect: true, message: "Correct." };
  const typo = ex.answers.find((a) => isTypo(given, a));
  if (typo)
    return {
      ...base,
      status: "close",
      isCorrect: true,
      message: `Almost — check the spelling: “${typo}”.`,
    };
  return { ...base, status: "incorrect", isCorrect: false, message: `The answer is “${ex.answers[0]}”.` };
}

function gradeMatch(ex: Extract<Exercise, { type: "match" }>, res: ExerciseResponse): GradeResult {
  const chosen = res.kind === "match" ? res.rightForLeft : [];
  const pairResults = ex.pairs.map((p, i) => chosen[i] === p.right);
  const right = pairResults.filter(Boolean).length;
  const all = right === ex.pairs.length;
  return {
    status: all ? "correct" : "incorrect",
    isCorrect: all,
    pairResults,
    expected: ex.pairs.map((p) => `${p.left} → ${p.right}`),
    message: all ? "All pairs matched correctly." : `${right} of ${ex.pairs.length} pairs are correct.`,
    explanation: ex.explanation,
  };
}

function gradeOrder(ex: Extract<Exercise, { type: "order" }>, res: ExerciseResponse): GradeResult {
  const given = textOf(res);
  const ok = ex.answers.some((a) => canonical(a) === canonical(given));
  return {
    status: ok ? "correct" : "incorrect",
    isCorrect: ok,
    expected: ex.answers,
    message: ok ? "Correct word order." : `A correct order is: “${ex.answers[0]}”.`,
    explanation: ex.explanation,
    learnerSentence: given,
    correctSentence: ex.answers[0],
  };
}

function gradeTransform(ex: Extract<Exercise, { type: "transform" | "correct" | "rephrase" | "formality" }>, res: ExerciseResponse): GradeResult {
  const given = textOf(res).trim();
  const base = { expected: ex.answers, explanation: ex.explanation, learnerSentence: given, correctSentence: ex.answers[0] };
  if (!given) return { ...base, status: "incorrect", isCorrect: false, message: "No answer given." };

  const g = canonical(given);
  if (ex.answers.some((a) => canonical(a) === g)) return { ...base, status: "correct", isCorrect: true, message: "Correct." };

  if (ex.type === "correct" && g === canonical(ex.source))
    return { ...base, status: "incorrect", isCorrect: false, message: "The sentence still contains the mistake." };

  const typo = ex.answers.find((a) => isTypo(given, a));
  if (typo) return { ...base, status: "close", isCorrect: true, message: `Almost — check the spelling against “${typo}”.` };

  if (ex.keyword && !containsPhrase(given, ex.keyword))
    return { ...base, status: "incorrect", isCorrect: false, message: `Remember to use “${ex.keyword}”.` };

  if (ex.open) {
    const required = ex.mustInclude ?? [];
    const missing = required.filter((r) => !containsPhrase(given, r, { exact: true }));
    if (missing.length === 0)
      return {
        ...base,
        status: "unverified",
        isCorrect: null,
        message: "Your answer differs from the model answers but may well be correct. Compare it, then decide.",
      };
    return { ...base, status: "incorrect", isCorrect: false, message: `Your answer needs to include: ${missing.map((m) => `“${m}”`).join(", ")}.` };
  }
  return { ...base, status: "incorrect", isCorrect: false, message: `A correct version is: “${ex.answers[0]}”.` };
}

function gradeProduce(ex: Extract<Exercise, { type: "produce" }>, res: ExerciseResponse): GradeResult {
  const given = textOf(res).trim();
  const base = { expected: ex.modelAnswers, explanation: ex.explanation, learnerSentence: given };
  const min = ex.minWords ?? 6;
  if (wordCount(given) < min)
    return { ...base, status: "incorrect", isCorrect: false, message: `Write a complete sentence of at least ${min} words.` };
  const missing = ex.targets.filter((t) => !containsPhrase(given, t) && !(ex.alternatives?.[t] ?? []).some((a) => containsPhrase(given, a)));
  if (missing.length)
    return {
      ...base,
      status: "incorrect",
      isCorrect: false,
      message: `Include the target expression${missing.length > 1 ? "s" : ""}: ${missing.map((m) => `“${m}”`).join(", ")}.`,
    };
  return {
    ...base,
    status: "unverified",
    isCorrect: null,
    message: "You used the target expression. Compare your sentence with the examples, or ask the tutor to check it.",
  };
}
