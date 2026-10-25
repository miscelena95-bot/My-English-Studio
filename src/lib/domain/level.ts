/**
 * Provisional level estimation. Deliberately conservative and explainable:
 * the result is a starting point for personalisation, not a certification.
 */

export type Band = "B1" | "B2" | "C1";
export const BAND_WEIGHT: Record<Band, number> = { B1: 1, B2: 1.5, C1: 2 };

export interface DiagnosticAnswer {
  band: Band;
  correct: boolean;
  topicId?: string;
}

export function weightedScore(answers: DiagnosticAnswer[]): number {
  const total = answers.reduce((s, a) => s + BAND_WEIGHT[a.band], 0);
  if (!total) return 0;
  return answers.reduce((s, a) => s + (a.correct ? BAND_WEIGHT[a.band] : 0), 0) / total;
}

/** Map a weighted score onto a provisional level. Never returns C1: a short quiz can't show that. */
export function levelFromScore(score: number): "A2" | "B1" | "B1+" | "B2" | "B2+" {
  if (score < 0.3) return "A2";
  if (score < 0.5) return "B1";
  if (score < 0.68) return "B1+";
  if (score < 0.85) return "B2";
  return "B2+";
}

export function estimateFromDiagnostic(answers: DiagnosticAnswer[]) {
  const score = weightedScore(answers);
  const level = levelFromScore(score);
  const weakTopics = Array.from(new Set(answers.filter((a) => !a.correct && a.topicId).map((a) => a.topicId!)));
  const byBand = (["B1", "B2", "C1"] as Band[]).map((band) => {
    const items = answers.filter((a) => a.band === band);
    return { band, correct: items.filter((a) => a.correct).length, total: items.length };
  });
  const evidence = byBand.filter((b) => b.total > 0).map((b) => `${b.correct} of ${b.total} ${b.band}-level questions correct`);
  return { score, level, weakTopics, evidence };
}

export interface PerformanceEvidence {
  /** accuracy on objective items in the last 30 days, by band of the topic */
  b2Accuracy: number | null;
  b2Attempts: number;
  speakingSessions: number;
  writingWithFeedback: number;
}

/**
 * Suggest whether recent work is consistent with a higher level. Only makes a
 * suggestion when there is enough evidence, and explains it in words.
 */
export function performanceSignal(current: string, e: PerformanceEvidence): { message: string; suggestUp: boolean } | null {
  if (e.b2Attempts < 30) return null;
  const acc = e.b2Accuracy ?? 0;
  if (acc >= 0.8 && e.speakingSessions >= 3 && e.writingWithFeedback >= 2 && (current === "B1" || current === "B1+"))
    return {
      suggestUp: true,
      message: `You've answered ${Math.round(acc * 100)}% of ${e.b2Attempts} B2-level grammar items correctly in the last 30 days and kept up regular speaking and writing. Your controlled accuracy looks consistent with B2.`,
    };
  if (acc < 0.5)
    return { suggestUp: false, message: `B2-level items are still challenging (${Math.round(acc * 100)}% correct over ${e.b2Attempts} attempts). That's normal at this stage — keep recycling the same topics.` };
  return { suggestUp: false, message: `${Math.round(acc * 100)}% accuracy on ${e.b2Attempts} recent B2-level items.` };
}
