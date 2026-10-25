import type { Exercise } from "@/lib/exercises/types";

export type RealEnglishCategory = "news" | "film-tv" | "music" | "literature" | "travel" | "psychology" | "business";

export interface RealEnglishUnit {
  id: string;
  category: RealEnglishCategory;
  title: string;
  /** The language-learning objective — every unit has one. */
  objective: string;
  level: "B1+" | "B2" | "B2+";
  minutes: number;
  skill: "reading" | "listening";
  /** 1. Discover the topic. */
  discover: string;
  /** 2. Key expressions. libraryKey links to the Vocabulary Lab when the expression exists there. */
  keyExpressions: Array<{ phrase: string; meaning: string; libraryKey?: string }>;
  /** 3. The source material. */
  source: {
    kind: "original" | "public-domain" | "your-choice";
    title: string;
    author?: string;
    /** Attribution / licensing note shown with the text. */
    note: string;
    url?: string;
    urlLabel?: string;
    paragraphs?: string[];
    /** For "your-choice" units: instructions for picking legal material. */
    choose?: string;
  };
  /** 4. Comprehension questions. */
  comprehension: Exercise[];
  /** 5. Vocabulary/grammar practice. */
  practice: Exercise[];
  /** 6. Discussion questions. */
  discussion: string[];
  /** 7. Production. */
  production: { prompt: string; targets: string[]; minWords: number };
}
