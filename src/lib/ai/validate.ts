import { canonical, words } from "@/lib/domain/text";
import { normaliseCategory } from "@/lib/domain/mistake-categories";
import type { ContentActivity, ConversationReport, Correction, WritingFeedback } from "./schemas";

/**
 * Does `excerpt` really come from `source`? Tolerates punctuation, case and
 * small differences, but rejects corrections the model invented.
 */
export function quotesSource(excerpt: string, source: string): boolean {
  const e = canonical(excerpt);
  if (!e) return false;
  const s = canonical(source);
  if (s.includes(e)) return true;
  const ew = words(excerpt);
  if (ew.length < 3) return false;
  const sw = new Set(words(source));
  const overlap = ew.filter((w) => sw.has(w)).length / ew.length;
  return overlap >= 0.8;
}

/** Keep only corrections that quote the learner, actually change something, and have a known category. */
export function validateCorrections(list: Correction[], learnerText: string, max: number): Correction[] {
  const seen = new Set<string>();
  const out: Correction[] = [];
  for (const c of list) {
    if (!c.original?.trim() || !c.corrected?.trim()) continue;
    if (canonical(c.original) === canonical(c.corrected)) continue;
    if (!quotesSource(c.original, learnerText)) continue;
    const key = canonical(c.original);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, original: c.original.trim(), corrected: c.corrected.trim(), category: normaliseCategory(c.category) });
    if (out.length >= max) break;
  }
  return out;
}

export function validateReport(r: ConversationReport, learnerText: string): ConversationReport {
  const corrections = validateCorrections(r.corrections, learnerText, 5);
  const seen = new Set<string>();
  return {
    ...r,
    strengths: r.strengths.slice(0, 3),
    corrections,
    naturalAlternatives: r.naturalAlternatives.filter((a) => quotesSource(a.original, learnerText) && canonical(a.original) !== canonical(a.alternative)).slice(0, 3),
    usefulExpressions: r.usefulExpressions
      .filter((e) => {
        const k = canonical(e.phrase);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 5),
    grammarPatterns: r.grammarPatterns.slice(0, 2),
    followUpTask: { ...r.followUpTask, targetExpressions: r.followUpTask.targetExpressions.slice(0, 5) },
  };
}

export function validateWritingFeedback(f: WritingFeedback, learnerText: string): WritingFeedback {
  return {
    ...f,
    annotations: validateCorrections(f.annotations, learnerText, 12),
    priorities: f.priorities.slice(0, 3),
    naturalAlternatives: f.naturalAlternatives.filter((a) => quotesSource(a.original, learnerText)).slice(0, 4),
  };
}

export function validateContentActivity(a: ContentActivity): ContentActivity {
  return {
    ...a,
    keyExpressions: a.keyExpressions.slice(0, 6),
    comprehensionQuestions: a.comprehensionQuestions
      .filter((q) => q.options.length >= 3 && q.options.length <= 5 && q.answerIndex >= 0 && q.answerIndex < q.options.length && new Set(q.options).size === q.options.length)
      .slice(0, 4),
    discussionQuestions: a.discussionQuestions.slice(0, 4),
  };
}
