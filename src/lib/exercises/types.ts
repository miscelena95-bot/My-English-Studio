import type { MistakeCategory } from "@/lib/domain/mistake-categories";

/**
 * Every exercise in the app is plain data of one of these shapes. Objective
 * types are graded locally and deterministically (src/lib/exercises/grade.ts);
 * open types are checked for the target structure locally and, when an AI
 * provider is configured, can additionally be reviewed by the tutor.
 */

interface Base {
  id: string;
  /** Short instruction shown above the item. */
  instruction?: string;
  /** Situation / context that makes the item communicative. */
  context?: string;
  explanation: string;
  /** Category used when a wrong answer is logged in the mistake tracker. */
  category?: MistakeCategory;
  /** Optional finer-grained pattern for grouping repeated mistakes. */
  pattern?: string;
  difficulty?: 1 | 2 | 3;
  hint?: string;
}

export interface MultipleChoice extends Base {
  type: "mcq";
  prompt: string;
  options: string[];
  /** Index of the correct option; several indices when more than one is acceptable. */
  answer: number | number[];
  /** Optional per-option feedback, shown when that option is chosen. */
  optionFeedback?: Record<number, string>;
}

export interface GapFill extends Base {
  type: "gap";
  /** Text containing exactly one "___". */
  text: string;
  answers: string[];
  /** Word to transform (word formation): shown in capitals after the gap. */
  root?: string;
}

export interface Match extends Base {
  type: "match";
  prompt: string;
  pairs: Array<{ left: string; right: string }>;
}

export interface WordOrder extends Base {
  type: "order";
  /** The correct sentence's words, in a canonical order; shuffled at render time. */
  words: string[];
  answers: string[];
}

export interface Transform extends Base {
  /** transform: rewrite; correct: fix the mistake; rephrase: use a target expression; formality: change register */
  type: "transform" | "correct" | "rephrase" | "formality";
  prompt: string;
  source: string;
  keyword?: string;
  /** Known correct answers. Not exhaustive for open items (see `open`). */
  answers: string[];
  /**
   * When true, many correct answers are possible. An answer that doesn't match
   * `answers` but contains every item in `mustInclude` is reported as
   * "unverified" (never as wrong) and the learner can compare or ask the tutor.
   */
  open?: boolean;
  mustInclude?: string[];
}

export interface Produce extends Base {
  type: "produce";
  prompt: string;
  /** Expression(s) the learner must use. */
  targets: string[];
  /** Accepted alternative forms per target, e.g. "comfort zone" for "step out of your comfort zone". */
  alternatives?: Record<string, string[]>;
  modelAnswers: string[];
  minWords?: number;
}

export type Exercise = MultipleChoice | GapFill | Match | WordOrder | Transform | Produce;
export type ExerciseType = Exercise["type"];

export type GradeStatus = "correct" | "close" | "incorrect" | "unverified";

export interface GradeResult {
  status: GradeStatus;
  /** True only for definitely correct (and close/typo) answers. */
  isCorrect: boolean | null;
  /** What the learner should compare against. */
  expected: string[];
  message: string;
  explanation: string;
  /** For match exercises: which pairs were right. */
  pairResults?: boolean[];
  /** Sentence with the learner's answer inserted (gap) — used for mistake logging. */
  learnerSentence?: string;
  correctSentence?: string;
}

/** Response shapes per exercise type. */
export type ExerciseResponse =
  | { kind: "choice"; index: number }
  | { kind: "text"; value: string }
  | { kind: "match"; rightForLeft: string[] }
  | { kind: "order"; sequence: string[] };
