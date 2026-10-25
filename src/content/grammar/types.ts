import type { Exercise } from "@/lib/exercises/types";

export interface GrammarTopic {
  id: string;
  title: string;
  group: "Verb forms" | "Modals & conditionals" | "Sentence building" | "Nouns & determiners" | "Professional English";
  level: "B1" | "B1+" | "B2" | "B2+";
  /** 1. A clear learning objective. */
  objective: string;
  /** The real-life situation used to teach the structure ("grammar in context"). */
  situation: string;
  /** 2. A concise explanation in English (short paragraphs). */
  explanation: string[];
  /** 3. Form and meaning. */
  form: Array<{ label: string; pattern: string; example: string }>;
  /** 4. When and why it is used. */
  use: string[];
  /** 5. Natural example sentences. */
  examples: string[];
  /** 6. Comparison with frequently confused structures. */
  contrasts: Array<{ title: string; a: string; b: string; note: string }>;
  /** 7. Typical errors by Italian speakers (only where relevant). */
  italianErrors: Array<{ wrong: string; right: string; note: string }>;
  /** 8. Guided practice. */
  guided: Exercise[];
  /** 9. Independent practice. */
  independent: Exercise[];
  /** 10. A short communicative task. */
  task: {
    title: string;
    prompt: string;
    /** Words/structures we can check locally to confirm the target grammar was attempted. */
    lookFor: Array<{ label: string; anyOf: string[] }>;
    minWords: number;
    modelAnswer: string;
    speakingScenarioId?: string;
  };
  /** 11. Summary of the key points. */
  keyPoints: string[];
  relatedVocabSet?: string;
}
