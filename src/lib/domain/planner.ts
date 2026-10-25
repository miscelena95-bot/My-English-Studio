/**
 * Daily session planner. Deterministic and explainable: every step carries a
 * human-readable reason derived from the learner's data.
 */

export type StepKind = "vocab-review" | "vocab-learn" | "mistake-review" | "grammar" | "speaking" | "fluency" | "writing" | "real-english" | "reflection";

export interface PlanStep {
  kind: StepKind;
  title: string;
  minutes: number;
  href: string;
  reason: string;
  /** Activity kinds (and optional refId) that complete the step. */
  match: { kinds: string[]; refId?: string };
}

export interface DailyPlan {
  minutes: number;
  focus: "speaking" | "writing";
  mission: string;
  objective: string;
  why: string[];
  steps: PlanStep[];
  outcome: string;
}

export interface PlannerInput {
  minutes: number;
  aiConfigured: boolean;
  dueReviews: number;
  /** Top mistake category label and count, if any. */
  topMistake: { label: string; count: number } | null;
  activeMistakes: number;
  /** A grammar topic that needs work, with the reason. */
  weakTopic: { id: string; title: string; reason: string } | null;
  daysSinceSpeaking: number | null;
  daysSinceWriting: number | null;
  /** Next learning-path lesson (if the learner follows the path). */
  lesson: {
    id: string;
    title: string;
    objective: string;
    vocabSetId?: string;
    grammarTopicId?: string;
    grammarTitle?: string;
    scenarioId?: string;
    scenarioTitle?: string;
    writingTaskId?: string;
    writingTitle?: string;
  } | null;
  fallbackScenario: { id: string; title: string; objective: string };
  fallbackWriting: { id: string; title: string; objective: string };
  fallbackDrill: { id: string; title: string };
  content: { id: string; title: string; objective: string } | null;
  newSet: { id: string; title: string } | null;
}

export function chooseFocus(i: Pick<PlannerInput, "daysSinceSpeaking" | "daysSinceWriting">): "speaking" | "writing" {
  // Speaking is the top priority: it's the default focus, but writing gets a turn
  // when it has been neglected for a few days and speaking was practised recently.
  const s = i.daysSinceSpeaking ?? 99;
  const w = i.daysSinceWriting ?? 99;
  if (w >= 3 && s <= 1) return "writing";
  return "speaking";
}

export function planDailySession(i: PlannerInput): DailyPlan {
  const minutes = i.minutes <= 12 ? 10 : i.minutes >= 35 ? 40 : 25;
  const focus = chooseFocus(i);
  const why: string[] = [];
  const steps: PlanStep[] = [];

  // 1. Retrieval warm-up.
  if (i.dueReviews > 0) {
    steps.push({
      kind: "vocab-review",
      title: `Review ${Math.min(i.dueReviews, minutes === 10 ? 6 : 10)} expressions`,
      minutes: 3,
      href: "/vocabulary/review",
      reason: `${i.dueReviews} expression${i.dueReviews > 1 ? "s are" : " is"} due for review — recalling them now strengthens memory.`,
      match: { kinds: ["vocab-review"] },
    });
  } else if (i.lesson?.vocabSetId || i.newSet) {
    const setId = i.lesson?.vocabSetId ?? i.newSet!.id;
    steps.push({
      kind: "vocab-learn",
      title: i.lesson ? "Learn today's expressions" : `New expressions: ${i.newSet!.title}`,
      minutes: 4,
      href: `/vocabulary/sets/${setId}`,
      reason: "Nothing is due for review, so this is a good moment to add new expressions.",
      match: { kinds: ["vocab-practice"], refId: setId },
    });
  }

  // 2. Focused practice: real mistakes first, then a weak grammar topic.
  if (minutes >= 25 || (minutes === 10 && i.activeMistakes >= 3 && i.dueReviews === 0)) {
    if (i.topMistake && i.activeMistakes >= 2) {
      steps.push({
        kind: "mistake-review",
        title: `Fix your recurring mistakes (${i.topMistake.label.toLowerCase()})`,
        minutes: 5,
        href: "/mistakes/practice",
        reason: `${i.topMistake.label} came up ${i.topMistake.count} time${i.topMistake.count > 1 ? "s" : ""} in your own work. Practising your own sentences is the fastest way to fix them.`,
        match: { kinds: ["mistake-review"] },
      });
      why.push(`Your mistake tracker shows a pattern in ${i.topMistake.label.toLowerCase()}.`);
    } else if (i.lesson?.grammarTopicId) {
      steps.push({
        kind: "grammar",
        title: `Grammar in context: ${i.lesson.grammarTitle}`,
        minutes: 5,
        href: `/grammar/${i.lesson.grammarTopicId}`,
        reason: `It's the structure you need for “${i.lesson.title}”.`,
        match: { kinds: ["grammar-practice"], refId: i.lesson.grammarTopicId },
      });
    } else if (i.weakTopic) {
      steps.push({
        kind: "grammar",
        title: `Grammar: ${i.weakTopic.title}`,
        minutes: 5,
        href: `/grammar/${i.weakTopic.id}`,
        reason: i.weakTopic.reason,
        match: { kinds: ["grammar-practice"], refId: i.weakTopic.id },
      });
      why.push(i.weakTopic.reason);
    }
  }

  // 3. Production — the heart of the session.
  const prodMinutes = minutes === 10 ? 5 : 10;
  let objective: string;
  if (focus === "speaking") {
    if (i.aiConfigured) {
      const sc = i.lesson?.scenarioId ? { id: i.lesson.scenarioId, title: i.lesson.scenarioTitle!, objective: i.lesson.objective } : i.fallbackScenario;
      steps.push({
        kind: "speaking",
        title: `Speak: ${sc.title}`,
        minutes: prodMinutes,
        href: `/speaking/new?scenario=${sc.id}`,
        reason: i.daysSinceSpeaking === null ? "Speaking is your top priority — let's start using English actively." : i.daysSinceSpeaking >= 2 ? `You last practised speaking ${i.daysSinceSpeaking} days ago.` : "Speaking fluently is your first goal, so it gets the most time.",
        match: { kinds: ["speaking"] },
      });
      objective = sc.objective;
    } else {
      steps.push({
        kind: "fluency",
        title: `Fluency drill: ${i.fallbackDrill.title}`,
        minutes: prodMinutes,
        href: `/speaking/fluency/${i.fallbackDrill.id}`,
        reason: "Speaking is your top priority. (AI conversation isn't configured, so today uses a timed drill with self-review.)",
        match: { kinds: ["fluency"] },
      });
      objective = "Speak for longer without stopping to translate.";
    }
    why.push(i.daysSinceSpeaking !== null && i.daysSinceSpeaking >= 2 ? `You haven't practised speaking for ${i.daysSinceSpeaking} days.` : "Speaking fluently is your first goal.");
  } else {
    const w = i.lesson?.writingTaskId ? { id: i.lesson.writingTaskId, title: i.lesson.writingTitle!, objective: i.lesson.objective } : i.fallbackWriting;
    steps.push({
      kind: "writing",
      title: `Write: ${w.title}`,
      minutes: prodMinutes,
      href: `/writing/new?task=${w.id}`,
      reason: `You last wrote something ${i.daysSinceWriting ?? "a while"} days ago — writing is your second priority.`,
      match: { kinds: ["writing"] },
    });
    objective = w.objective;
    why.push(i.daysSinceWriting === null ? "You haven't tried the Writing Workshop yet." : `It's been ${i.daysSinceWriting} days since your last piece of writing.`);
  }
  const mission = i.lesson ? i.lesson.title : objective.replace(/\.$/, "");

  // 4. Authentic content (25+ minutes).
  if (minutes >= 25 && i.content) {
    steps.push({
      kind: "real-english",
      title: `Real English: ${i.content.title}`,
      minutes: 5,
      href: `/real-english/${i.content.id}`,
      reason: `Chosen from your interests. Objective: ${i.content.objective}`,
      match: { kinds: ["real-english"], refId: i.content.id },
    });
  }

  // Extended sessions add the other production skill.
  if (minutes === 40) {
    if (focus === "speaking") {
      const w = i.lesson?.writingTaskId ? { id: i.lesson.writingTaskId, title: i.lesson.writingTitle! } : i.fallbackWriting;
      steps.push({ kind: "writing", title: `Write: ${w.title}`, minutes: 10, href: `/writing/new?task=${w.id}`, reason: "Extended session: transfer today's language into writing.", match: { kinds: ["writing"] } });
    } else {
      steps.push({ kind: "fluency", title: `Fluency drill: ${i.fallbackDrill.title}`, minutes: 8, href: `/speaking/fluency/${i.fallbackDrill.id}`, reason: "Extended session: say today's ideas out loud.", match: { kinds: ["fluency", "speaking"] } });
    }
  }

  steps.push({
    kind: "reflection",
    title: "Reflect and plan tomorrow",
    minutes: 2,
    href: "/session",
    reason: "A short summary helps you notice what you've learnt.",
    match: { kinds: ["__reflection__"] },
  });

  if (i.lesson) why.unshift(`It's the next lesson in your Learning Path: “${i.lesson.title}”.`);

  return {
    minutes,
    focus,
    mission,
    objective,
    why: Array.from(new Set(why)).slice(0, 3),
    steps,
    outcome: focus === "speaking" ? "You'll have spoken English in a realistic situation and know exactly what to improve." : "You'll have a piece of writing with feedback, ready to revise.",
  };
}

/** Which plan steps are done, given activities completed since the session started. */
export function stepCompletion(steps: PlanStep[], activities: Array<{ kind: string; refId: string | null; completedAt: Date | null }>, sessionCompleted: boolean): boolean[] {
  return steps.map((s) => {
    if (s.kind === "reflection") return sessionCompleted;
    return activities.some((a) => a.completedAt && s.match.kinds.includes(a.kind) && (!s.match.refId || a.refId === s.match.refId));
  });
}
