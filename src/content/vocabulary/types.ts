import type { Exercise } from "@/lib/exercises/types";

export interface LibraryEntry {
  id: string;
  phrase: string;
  pos: string;
  definition: string;
  /** Natural examples. At least one must contain the phrase (or one of `forms`). */
  examples: string[];
  /** Inflected forms used in the examples, e.g. "running behind schedule". */
  forms?: string[];
  collocations?: string[];
  synonyms?: string[];
  register?: "neutral" | "formal" | "informal" | "spoken" | "written";
  registerNote?: string;
  /** Stress pattern in capitals, e.g. "as far as I'm con-CERNED". */
  stress?: string;
  ipa?: string;
  mistakes?: string[];
  /** Contrast with Italian, only where it genuinely helps. */
  italian?: string;
  context?: string;
  level?: "B1" | "B2" | "C1";
}

export interface VocabSet {
  id: string;
  title: string;
  theme: "conversation" | "professional" | "events" | "language" | "culture";
  description: string;
  /** Why this set matters for this learner. */
  why: string;
  entries: LibraryEntry[];
  /** Hand-written exercises (collocations, word formation, halves, naturalness…). */
  exercises: Exercise[];
}
