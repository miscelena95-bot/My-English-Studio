import type { Exercise } from "./types";
import { gradeExercise } from "./grade";
import type { ReviewMode } from "@/lib/domain/srs";

/** Minimal shape needed to build exercises from any vocabulary record (library or personal). */
export interface VocabLike {
  key: string;
  phrase: string;
  definition: string;
  examples: string[];
  forms?: string[];
  italian?: string | null;
  mistakes?: string[];
}

/** The usable core of a phrase: "As far as I'm concerned, ..." → "As far as I'm concerned". */
export function phraseCore(phrase: string): string {
  return phrase
    .replace(/\(.*?\)/g, " ")
    .replace(/\+\s*-?ing\b/g, " ")
    .replace(/(\.\.\.|…)\w*/g, " ")
    .replace(/\b(sb|sth)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,.;:!?]+$/g, "")
    .trim();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find an example sentence containing the phrase (or a listed form) and blank it out. */
export function gapFromExamples(v: VocabLike): { text: string; answer: string } | null {
  const candidates = [phraseCore(v.phrase), ...(v.forms ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 1)
    .sort((a, b) => b.length - a.length);
  for (const ex of v.examples) {
    for (const c of candidates) {
      const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(c)})(?=$|[^\\p{L}])`, "iu");
      const m = ex.match(re);
      if (m && m.index !== undefined) {
        const start = m.index + m[1].length;
        const found = ex.slice(start, start + m[2].length);
        return { text: ex.slice(0, start) + "___" + ex.slice(start + found.length), answer: found };
      }
    }
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic distractors so the server can re-create exactly the exercise the learner saw. */
function pickDistractors(v: VocabLike, pool: VocabLike[], n: number): VocabLike[] {
  const others = pool.filter((p) => p.key !== v.key && p.phrase.toLowerCase() !== v.phrase.toLowerCase());
  const sorted = [...others].sort((a, b) => (hash(v.key + a.key) % 9973) - (hash(v.key + b.key) % 9973));
  return sorted.slice(0, n);
}

function placeAnswer<T>(correct: T, distractors: T[], seed: string): { options: T[]; answer: number } {
  const pos = hash(seed) % (distractors.length + 1);
  const options = [...distractors];
  options.splice(pos, 0, correct);
  return { options, answer: pos };
}

export const VOCAB_EXERCISE_MODES = ["meaning", "phrase", "gap", "recall", "produce"] as const;
export type VocabExerciseMode = (typeof VOCAB_EXERCISE_MODES)[number];

export function vocabExerciseId(key: string, mode: VocabExerciseMode) {
  return `v:${mode}:${key}`;
}

export function parseVocabExerciseId(id: string): { mode: VocabExerciseMode; key: string } | null {
  const m = id.match(/^v:(meaning|phrase|gap|recall|produce):(.+)$/);
  return m ? { mode: m[1] as VocabExerciseMode, key: m[2] } : null;
}

/** Which concrete exercise to use for a review mode (recognition → recall → production). */
export function modeForReview(review: ReviewMode, v: VocabLike): VocabExerciseMode {
  if (review === "recognition") return hash(v.key) % 2 === 0 ? "phrase" : "meaning";
  if (review === "recall") return gapFromExamples(v) ? "gap" : "recall";
  return "produce";
}

export function reviewModeOf(mode: VocabExerciseMode): ReviewMode {
  return mode === "meaning" || mode === "phrase" ? "recognition" : mode === "produce" ? "production" : "recall";
}

export function buildVocabExercise(v: VocabLike, mode: VocabExerciseMode, pool: VocabLike[]): Exercise {
  const id = vocabExerciseId(v.key, mode);
  const core = phraseCore(v.phrase);
  const note = v.italian ? ` Note for Italian speakers: ${v.italian}` : "";
  switch (mode) {
    case "phrase": {
      const d = pickDistractors(v, pool, 3).map((x) => x.phrase);
      const { options, answer } = placeAnswer(v.phrase, d, id);
      return {
        id,
        type: "mcq",
        instruction: "Which expression matches the definition?",
        prompt: v.definition,
        options,
        answer,
        explanation: `“${v.phrase}” — ${v.definition}${v.examples[0] ? ` Example: ${v.examples[0]}` : ""}`,
        category: "vocabulary",
        difficulty: 1,
      };
    }
    case "meaning": {
      const d = pickDistractors(v, pool, 3).map((x) => x.definition);
      const { options, answer } = placeAnswer(v.definition, d, id);
      return {
        id,
        type: "mcq",
        instruction: "What does this expression mean?",
        prompt: v.phrase,
        options,
        answer,
        explanation: `${v.examples[0] ? `Example: ${v.examples[0]}` : ""}${note}`.trim() || v.definition,
        category: "vocabulary",
        difficulty: 1,
      };
    }
    case "gap": {
      const g = gapFromExamples(v);
      if (!g) return buildVocabExercise(v, "recall", pool);
      return {
        id,
        type: "gap",
        instruction: "Complete the sentence with the expression.",
        context: v.definition,
        text: g.text,
        answers: Array.from(new Set([g.answer, core])),
        hint: `Starts with “${g.answer.slice(0, 2)}…”`,
        explanation: `${v.phrase}: ${v.definition}${note}`,
        category: "vocabulary",
        difficulty: 2,
      };
    }
    case "recall":
      return {
        id,
        type: "gap",
        instruction: "Active recall: write the expression from its definition.",
        text: `${v.definition} → ___`,
        answers: Array.from(new Set([core, v.phrase, ...(v.forms ?? [])])),
        hint: `Starts with “${core.slice(0, 2)}…” (${core.split(" ").length} word${core.split(" ").length > 1 ? "s" : ""})`,
        explanation: `${v.phrase}${v.examples[0] ? ` — e.g. ${v.examples[0]}` : ""}${note}`,
        category: "vocabulary",
        difficulty: 3,
      };
    case "produce": {
      const alternatives = v.forms?.length ? { [core]: v.forms } : undefined;
      const coreWords = core.split(" ").length;
      // Whole-sentence expressions ("I look forward to hearing from you") need no extra words.
      const minWords = Math.max(5, coreWords + (coreWords >= 5 ? 0 : 2));
      const draft: Exercise = { id, type: "produce", prompt: "", targets: [core], alternatives, modelAnswers: [], minWords, explanation: "" };
      // Only show examples that would pass the same check the learner faces.
      const passing = v.examples.filter((x) => gradeExercise(draft, { kind: "text", value: x }).status === "unverified");
      return {
        id,
        type: "produce",
        instruction: "Use it in your own sentence.",
        prompt: `Write a sentence about your life or work using “${core}”.`,
        targets: [core],
        alternatives,
        modelAnswers: (passing.length ? passing : v.examples).slice(0, 2),
        minWords,
        explanation: `Producing an expression in your own context is the best way to make it active.${v.mistakes?.[0] ? ` Watch out: ${v.mistakes[0]}` : ""}`,
        difficulty: 3,
      };
    }
  }
}

/** A match exercise built from several entries (definitions ↔ phrases). */
export function buildMatchExercise(id: string, entries: VocabLike[]): Exercise {
  return {
    id,
    type: "match",
    instruction: "Match each expression to its meaning.",
    prompt: "Match the expressions and definitions.",
    pairs: entries.slice(0, 5).map((e) => ({ left: e.phrase, right: e.definition })),
    explanation: "Seeing expressions side by side helps you notice the differences between them.",
    category: "vocabulary",
  };
}
