import { GRAMMAR_TOPICS, topicExercises } from "@/content/grammar";
import { VOCAB_SETS } from "@/content/vocabulary";
import { DIAGNOSTIC_ITEMS } from "@/content/diagnostic";
import { REAL_ENGLISH_UNITS } from "@/content/real-english";
import type { Exercise } from "./types";

export interface ExerciseOrigin {
  exercise: Exercise;
  skill: "grammar" | "vocabulary" | "reading" | "listening";
  topicId: string;
  /** Logged to the mistake tracker when answered incorrectly. */
  loggable: boolean;
}

const REGISTRY = new Map<string, ExerciseOrigin>();

for (const t of GRAMMAR_TOPICS)
  for (const exercise of topicExercises(t)) REGISTRY.set(exercise.id, { exercise, skill: "grammar", topicId: t.id, loggable: true });
for (const s of VOCAB_SETS)
  for (const exercise of s.exercises) REGISTRY.set(exercise.id, { exercise, skill: "vocabulary", topicId: s.id, loggable: true });
for (const exercise of DIAGNOSTIC_ITEMS)
  REGISTRY.set(exercise.id, { exercise, skill: exercise.section, topicId: exercise.topicId ?? "diagnostic", loggable: false });
for (const u of REAL_ENGLISH_UNITS) {
  for (const exercise of u.comprehension) REGISTRY.set(exercise.id, { exercise, skill: u.skill, topicId: u.id, loggable: false });
  for (const exercise of u.practice) REGISTRY.set(exercise.id, { exercise, skill: "vocabulary", topicId: u.id, loggable: true });
}

export function staticExercise(id: string): ExerciseOrigin | undefined {
  return REGISTRY.get(id);
}

export function allStaticExercises() {
  return [...REGISTRY.values()];
}
