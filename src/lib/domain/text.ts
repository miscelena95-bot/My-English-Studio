/**
 * Text utilities used by deterministic grading. The goal is to accept every
 * reasonable way of typing a correct answer (curly quotes, contractions,
 * capitalisation, trailing punctuation, double spaces) while still rejecting
 * genuinely different answers.
 */

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\bcan't\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bain't\b/g, "is not"],
  [/\blet's\b/g, "let us"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they|who|what)'re\b/g, "$1 are"],
  [/\b(\w+)'ve\b/g, "$1 have"],
  [/\b(\w+)'ll\b/g, "$1 will"],
  [/\b(i|you|he|she|we|they|who|that|there)'d\b/g, "$1 would"],
  // "'s" is ambiguous (is / has / possessive). Only expand after pronouns and
  // question words, where it can't be possessive. "is" and "has" both map to
  // the same token so either expansion matches.
  [/\b(he|she|it|that|there|what|where|who|how|here)'s\b/g, "$1 _s"],
  [/\b(he|she|it|that|there|what|where|who|how|here) (is|has)\b/g, "$1 _s"],
];

export function normaliseQuotes(s: string): string {
  return s.replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
}

/**
 * Canonical form for comparison: lower case, straight quotes, contractions
 * expanded, punctuation removed (except apostrophes inside words), single spaces.
 */
export function canonical(input: string): string {
  let s = normaliseQuotes(input).toLowerCase().trim();
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s
    .replace(/[^\p{L}\p{N}'_\s-]/gu, " ")
    .replace(/(^|\s)'|'(\s|$)/g, " ")
    .replace(/\s-\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function words(input: string): string[] {
  const c = canonical(input);
  return c ? c.split(" ") : [];
}

export function wordCount(input: string): number {
  const t = normaliseQuotes(input).trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Word-level edit distance, useful to describe how far a sentence is from a target. */
export function wordDistance(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  let prev = Array.from({ length: wb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= wa.length; i++) {
    const cur = [i];
    for (let j = 1; j <= wb.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (wa[i - 1] === wb[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[wb.length];
}

/**
 * Does `text` use `phrase`? Tolerates contractions, inflection of the first
 * verb (e.g. "run behind schedule" matches "we're running behind schedule")
 * and placeholder slots written as "..." or "sb/sth".
 */
export function containsPhrase(text: string, phrase: string, opts: { exact?: boolean } = {}): boolean {
  const t = ` ${canonical(text)} `;
  const core = phrase
    .replace(/\.\.\.|…/g, " ")
    .replace(/\b(sb|sth|someone|something|somebody)\b/gi, " ")
    .replace(/[?!.]/g, " ");
  const parts = canonical(core).split(" ").filter(Boolean);
  if (!parts.length) return false;
  if (t.includes(` ${parts.join(" ")} `)) return true;
  // Exact mode is for grammar-structure checks, where "announce" ≠ "announced".
  if (opts.exact) return false;
  // Allow inflection of each word (run → running/ran/runs) by matching stems,
  // and allow up to two words inserted where the phrase had a slot.
  const stems = parts.map(stem);
  const tw = t.trim().split(" ");
  for (let start = 0; start < tw.length; start++) {
    let i = start;
    let k = 0;
    let gaps = 0;
    while (i < tw.length && k < stems.length) {
      if (stem(tw[i]) === stems[k] || irregularMatch(tw[i], parts[k])) {
        k++;
        i++;
      } else if (k > 0 && gaps < 3) {
        gaps++;
        i++;
      } else break;
    }
    if (k === stems.length) return true;
  }
  return false;
}

const IRREGULAR: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being", "_s"],
  have: ["has", "had", "having", "_s"],
  do: ["does", "did", "done", "doing"],
  go: ["goes", "went", "gone", "going"],
  get: ["gets", "got", "gotten", "getting"],
  make: ["makes", "made", "making"],
  take: ["takes", "took", "taken", "taking"],
  come: ["comes", "came", "coming"],
  turn: ["turns", "turned", "turning"],
  run: ["runs", "ran", "running"],
  put: ["puts", "putting"],
  set: ["sets", "setting"],
  bring: ["brings", "brought", "bringing"],
  keep: ["keeps", "kept", "keeping"],
  think: ["thinks", "thought", "thinking"],
  say: ["says", "said", "saying"],
  see: ["sees", "saw", "seen", "seeing"],
  give: ["gives", "gave", "given", "giving"],
  fall: ["falls", "fell", "fallen", "falling"],
  catch: ["catches", "caught", "catching"],
  find: ["finds", "found", "finding"],
  leave: ["leaves", "left", "leaving"],
  hold: ["holds", "held", "holding"],
  break: ["breaks", "broke", "broken", "breaking"],
  my: ["your", "his", "her", "our", "their", "its"],
  i: ["you", "he", "she", "we", "they", "it"],
  am: ["are", "is", "was", "were"],
  me: ["you", "him", "her", "us", "them"],
  myself: ["yourself", "himself", "herself", "ourselves", "themselves"],
};

function irregularMatch(word: string, base: string): boolean {
  return IRREGULAR[base]?.includes(word) ?? false;
}

/** True when a and b are forms of the same (possibly irregular) verb, e.g. see/saw, live/lived. */
export function sameVerbFamily(a: string, b: string): boolean {
  if (a === b) return false;
  for (const [base, forms] of Object.entries(IRREGULAR)) {
    if (["my", "i", "am", "me", "myself"].includes(base)) continue;
    const all = [base, ...forms];
    if (all.includes(a) && all.includes(b)) return true;
  }
  const inflected = (w: string) => /(ing|ed|es|en|s)$/.test(w);
  return (inflected(a) || inflected(b)) && stem(a).length >= 3 && stem(a) === stem(b);
}

/** Simple tokenizer without contraction merging (used for comparing corrections). */
export function plainWords(input: string): string[] {
  return normaliseQuotes(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

export function stem(w: string): string {
  let s = w.toLowerCase();
  if (s.length <= 3) return s;
  for (const suf of ["ing", "ied", "ies", "ed", "es", "s"]) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) {
      s = s.slice(0, -suf.length);
      if (suf === "ied" || suf === "ies") s += "y";
      break;
    }
  }
  // running → runn → run ; planned → plann → plan
  if (/([bcdfghjklmnpqrstvwz])\1$/.test(s)) s = s.slice(0, -1);
  // "e" drop: making → mak, make → make; normalise by stripping final e
  if (s.endsWith("e") && s.length > 3) s = s.slice(0, -1);
  return s;
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function shuffle<T>(items: T[], seed = Date.now()): T[] {
  const a = [...items];
  let x = seed % 2147483647 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 16807) % 2147483647;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
