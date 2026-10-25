/**
 * The guided Learning Path. Each lesson is organised around a communicative
 * objective and combines expressions, grammar and a real task. Steps are
 * completed automatically when the matching activity is recorded.
 */

export type PathStep =
  | { kind: "vocab"; setId: string; label: string }
  | { kind: "grammar"; topicId: string; label: string }
  | { kind: "speaking"; scenarioId: string; label: string }
  | { kind: "writing"; taskId: string; label: string }
  | { kind: "real-english"; unitId: string; label: string };

export interface PathLesson {
  id: string;
  unit: string;
  title: string;
  objective: string;
  why: string;
  level: "B1+" | "B2" | "B2+";
  steps: PathStep[];
}

export const PATH_UNITS = ["Conversation foundations", "Working with clients", "Meetings and ideas", "Going further"] as const;

export const PATH_LESSONS: PathLesson[] = [
  {
    id: "l-small-talk",
    unit: "Conversation foundations",
    title: "Participate in small talk",
    objective: "Start and sustain a relaxed conversation with someone new.",
    why: "Small talk is the first impression you make with international guests and colleagues.",
    level: "B1+",
    steps: [
      { kind: "vocab", setId: "small-talk", label: "Learn 8 small-talk chunks" },
      { kind: "grammar", topicId: "question-formation", label: "Ask natural questions" },
      { kind: "speaking", scenarioId: "everyday-small-talk", label: "Role-play: dinner party" },
    ],
  },
  {
    id: "l-story",
    unit: "Conversation foundations",
    title: "Tell a story naturally",
    objective: "Tell a personal story with clear structure, suspense and correct past tenses.",
    why: "Stories are the most common thing we tell — and narrative tenses are a classic Italian-speaker challenge.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "storytelling", label: "Discourse markers for stories" },
      { kind: "grammar", topicId: "narrative-tenses", label: "Narrative tenses" },
      { kind: "speaking", scenarioId: "everyday-story", label: "Tell a friend what happened" },
      { kind: "writing", taskId: "w-personal-story", label: "Write it as a blog post" },
    ],
  },
  {
    id: "l-opinion",
    unit: "Conversation foundations",
    title: "Explain an opinion and support it with reasons",
    objective: "Give an opinion, justify it with two reasons and respond to a counter-argument.",
    why: "Moving beyond “I think…” makes you sound more fluent and convincing.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "opinions", label: "Opinion openers" },
      { kind: "grammar", topicId: "linking-words", label: "Linking reasons and contrasts" },
      { kind: "speaking", scenarioId: "disc-remote-work", label: "Debate: remote work" },
      { kind: "writing", taskId: "w-opinion-remote", label: "Write a short opinion piece" },
    ],
  },
  {
    id: "l-uncertainty",
    unit: "Conversation foundations",
    title: "Express uncertainty and degrees of confidence",
    objective: "Say how sure you are about present, past and future situations.",
    why: "In event work, plans change constantly — being precise about certainty builds trust.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "uncertainty", label: "From certain to unlikely" },
      { kind: "grammar", topicId: "deduction-speculation", label: "must have / might have / can't have" },
      { kind: "speaking", scenarioId: "events-day-problem", label: "The missing speaker" },
    ],
  },
  {
    id: "l-email",
    unit: "Working with clients",
    title: "Write a clear and polite email",
    objective: "Write professional emails that are clear, polite and natural.",
    why: "You write emails every day; small changes make you sound much more professional.",
    level: "B1+",
    steps: [
      { kind: "vocab", setId: "emails", label: "Email phrases" },
      { kind: "grammar", topicId: "professional-language", label: "Softening and politeness" },
      { kind: "writing", taskId: "w-schedule-change", label: "Inform a client about a change" },
    ],
  },
  {
    id: "l-problem",
    unit: "Working with clients",
    title: "Describe a professional problem",
    objective: "Explain what went wrong, why, and what you'll do about it.",
    why: "Clear problem descriptions reduce stress for you and for your clients.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "problems-complaints", label: "Problems and solutions" },
      { kind: "grammar", topicId: "present-perfect-vs-past-simple", label: "What has happened / what happened" },
      { kind: "speaking", scenarioId: "events-schedule-change", label: "Explain a schedule change" },
      { kind: "writing", taskId: "w-complaint-reply", label: "Reply to a complaint" },
    ],
  },
  {
    id: "l-disagree",
    unit: "Meetings and ideas",
    title: "Disagree diplomatically",
    objective: "Disagree without sounding rude and move towards a compromise.",
    why: "Direct disagreement can sound aggressive in English — softening is essential in meetings.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "disagreeing", label: "Diplomatic disagreement" },
      { kind: "grammar", topicId: "modal-verbs", label: "Suggestions with modals" },
      { kind: "speaking", scenarioId: "pro-meeting-disagree", label: "Meeting: the welcome dinner" },
    ],
  },
  {
    id: "l-meeting",
    unit: "Meetings and ideas",
    title: "Recount a meeting",
    objective: "Report accurately what people said and agreed.",
    why: "After every client meeting, you need to update your team and write a summary.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "meetings", label: "Meeting language" },
      { kind: "grammar", topicId: "reported-speech", label: "Reported speech" },
      { kind: "speaking", scenarioId: "pro-meeting-update", label: "Update your manager" },
      { kind: "writing", taskId: "w-meeting-summary", label: "Write the summary" },
    ],
  },
  {
    id: "l-present",
    unit: "Meetings and ideas",
    title: "Present an idea in a meeting",
    objective: "Structure a short pitch and handle questions.",
    why: "Signposted presentations are easier to deliver when you're nervous.",
    level: "B2+",
    steps: [
      { kind: "vocab", setId: "presenting", label: "Signposting" },
      { kind: "grammar", topicId: "complex-sentences", label: "Emphasis and complex sentences" },
      { kind: "speaking", scenarioId: "pro-present-idea", label: "Pitch to your director" },
      { kind: "writing", taskId: "w-proposal", label: "Write the proposal" },
    ],
  },
  {
    id: "l-negotiate",
    unit: "Going further",
    title: "Negotiate a practical arrangement",
    objective: "Make conditional offers and reach a fair agreement.",
    why: "Negotiating with suppliers and clients needs conditional, tentative language.",
    level: "B2",
    steps: [
      { kind: "vocab", setId: "negotiation", label: "Negotiation phrases" },
      { kind: "grammar", topicId: "conditionals", label: "Conditionals for offers" },
      { kind: "speaking", scenarioId: "events-supplier-negotiation", label: "Negotiate with the caterer" },
    ],
  },
  {
    id: "l-news",
    unit: "Going further",
    title: "Discuss a recent news story",
    objective: "Summarise a story and discuss its implications.",
    why: "Discussing current affairs is a great test of active vocabulary and opinion language.",
    level: "B2",
    steps: [
      { kind: "real-english", unitId: "news-headline-language", label: "Decode headlines" },
      { kind: "grammar", topicId: "passive-voice", label: "The passive in the news" },
      { kind: "speaking", scenarioId: "disc-news", label: "Discuss a story" },
      { kind: "writing", taskId: "w-news-response", label: "Respond in writing" },
    ],
  },
  {
    id: "l-welcome",
    unit: "Going further",
    title: "Welcome and guide international guests",
    objective: "Welcome guests warmly, give directions and recommendations.",
    why: "You'll use this at every event you organise in Genoa.",
    level: "B1+",
    steps: [
      { kind: "vocab", setId: "welcoming", label: "Welcoming phrases" },
      { kind: "real-english", unitId: "travel-genoa-caruggi", label: "Describe the old town" },
      { kind: "speaking", scenarioId: "events-welcome-attendees", label: "At the registration desk" },
    ],
  },
];

export function getLesson(id: string) {
  return PATH_LESSONS.find((l) => l.id === id);
}

export function stepHref(step: PathStep): string {
  switch (step.kind) {
    case "vocab":
      return `/vocabulary/sets/${step.setId}`;
    case "grammar":
      return `/grammar/${step.topicId}`;
    case "speaking":
      return `/speaking/new?scenario=${step.scenarioId}`;
    case "writing":
      return `/writing/new?task=${step.taskId}`;
    case "real-english":
      return `/real-english/${step.unitId}`;
  }
}

/** Activity (kind, refId) that completes a step. */
export function stepActivityKey(step: PathStep): { kinds: string[]; refId: string } {
  switch (step.kind) {
    case "vocab":
      return { kinds: ["vocab-practice"], refId: step.setId };
    case "grammar":
      return { kinds: ["grammar-practice"], refId: step.topicId };
    case "speaking":
      return { kinds: ["speaking"], refId: step.scenarioId };
    case "writing":
      return { kinds: ["writing"], refId: step.taskId };
    case "real-english":
      return { kinds: ["real-english"], refId: step.unitId };
  }
}
