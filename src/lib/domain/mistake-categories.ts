import { canonical, levenshtein, plainWords, sameVerbFamily } from "./text";

export const MISTAKE_CATEGORIES = [
  "grammar",
  "verb-tense",
  "articles",
  "prepositions",
  "word-order",
  "vocabulary",
  "collocation",
  "register",
  "naturalness",
  "spelling",
  "sentence-structure",
] as const;

export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MistakeCategory, string> = {
  grammar: "Grammar",
  "verb-tense": "Verb tense",
  articles: "Articles",
  prepositions: "Prepositions",
  "word-order": "Word order",
  vocabulary: "Vocabulary",
  collocation: "Collocations",
  register: "Register & tone",
  naturalness: "Naturalness",
  spelling: "Spelling",
  "sentence-structure": "Sentence structure",
};

/**
 * How much a category usually affects being understood. Used to prioritise
 * review so the learner isn't overwhelmed by minor slips.
 */
export const COMMUNICATIVE_WEIGHT: Record<MistakeCategory, number> = {
  "verb-tense": 3,
  "sentence-structure": 3,
  "word-order": 2.5,
  vocabulary: 2.5,
  grammar: 2,
  register: 2,
  collocation: 2,
  prepositions: 1.5,
  articles: 1.5,
  naturalness: 1.5,
  spelling: 1,
};

/** Grammar Lab topics that offer targeted practice for each category. */
export const CATEGORY_TOPICS: Record<MistakeCategory, string[]> = {
  "verb-tense": ["present-perfect-vs-past-simple", "narrative-tenses", "future-forms", "present-forms"],
  articles: ["articles-determiners", "countable-uncountable"],
  prepositions: ["prepositions"],
  "word-order": ["word-order", "question-formation", "indirect-questions"],
  grammar: ["gerunds-infinitives", "conditionals", "modal-verbs", "passive-voice", "reported-speech"],
  "sentence-structure": ["relative-clauses", "complex-sentences", "linking-words"],
  register: ["professional-language"],
  collocation: [],
  vocabulary: [],
  naturalness: [],
  spelling: [],
};

const ALIASES: Array<[RegExp, MistakeCategory]> = [
  [/tense|aspect|perfect|past simple|continuous|future/i, "verb-tense"],
  [/article|determiner/i, "articles"],
  [/preposition/i, "prepositions"],
  [/word.?order|inversion|position of/i, "word-order"],
  [/colloc/i, "collocation"],
  [/regist|formal|tone|polite/i, "register"],
  [/natural|idiomatic|unidiomatic|awkward|literal translation|phrasing/i, "naturalness"],
  [/spell|typo/i, "spelling"],
  [/structure|clause|fragment|run-on|syntax|punctuation/i, "sentence-structure"],
  [/vocab|word choice|false friend|lexical|meaning/i, "vocabulary"],
  [/grammar|agreement|plural|countable|auxiliary|modal|gerund|infinitive|conditional|passive|pronoun|question/i, "grammar"],
];

/** Map any free-text label (e.g. from AI feedback) onto a known category. */
export function normaliseCategory(label: string | null | undefined): MistakeCategory {
  if (!label) return "grammar";
  const l = label.trim().toLowerCase();
  if ((MISTAKE_CATEGORIES as readonly string[]).includes(l)) return l as MistakeCategory;
  for (const [re, cat] of ALIASES) if (re.test(l)) return cat;
  return "grammar";
}

const ARTICLES = new Set(["a", "an", "the"]);
const PREPOSITIONS = new Set([
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "about", "into", "onto", "over", "under",
  "during", "since", "until", "till", "towards", "through", "between", "among", "within", "without", "per", "upon",
]);
const AUX_TENSE = new Set(["have", "has", "had", "was", "were", "is", "are", "am", "will", "would", "did", "do", "does", "been", "be", "'s", "'ve", "'ll", "'d"]);

/**
 * Heuristically classify a correction by comparing the learner's sentence
 * with the corrected one. Used when no category is supplied (or to sanity
 * check one). Deliberately conservative: falls back to "grammar".
 */
export function categoriseCorrection(original: string, corrected: string): MistakeCategory {
  if (canonical(original) === canonical(corrected)) return "naturalness";
  const a = plainWords(original);
  const b = plainWords(corrected);

  // Same words, different order.
  if (a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ")) return "word-order";

  const removed = diff(a, b);
  const added = diff(b, a);
  const changed = [...removed, ...added];
  if (!changed.length) return "naturalness";

  if (changed.every((w) => ARTICLES.has(w))) return "articles";
  if (changed.every((w) => PREPOSITIONS.has(w))) return "prepositions";

  const lexical = changed.filter((w) => !AUX_TENSE.has(w));
  const verbFormsOnly = lexical.every((w) => lexical.some((o) => sameVerbFamily(w, o)) || /(ed|en|ing)$/.test(w));
  if (lexical.length > 0 && verbFormsOnly && (lexical.length < changed.length || lexical.length === 2)) return "verb-tense";
  if (lexical.length === 0) return "verb-tense";

  if (removed.length === 1 && added.length === 1) {
    const [r] = removed;
    const [n] = added;
    if (r.length > 3 && levenshtein(r, n) <= 2) return "spelling";
  }
  if (removed.length <= 2 && added.length <= 2) return "vocabulary";
  return "grammar";
}

function diff(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>();
  for (const w of b) counts.set(w, (counts.get(w) ?? 0) + 1);
  const out: string[] = [];
  for (const w of a) {
    const c = counts.get(w) ?? 0;
    if (c > 0) counts.set(w, c - 1);
    else out.push(w);
  }
  return out;
}

/** Stable key so that repeated instances of the same issue are grouped. */
export function patternKey(category: MistakeCategory, pattern: string | null | undefined, corrected: string): string {
  const base = (pattern && pattern.trim()) || canonical(corrected).split(" ").slice(0, 6).join(" ");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${category}:${slug}`;
}
