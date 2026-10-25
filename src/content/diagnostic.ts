import type { MultipleChoice } from "@/lib/exercises/types";

/**
 * A short, low-pressure diagnostic. Items are graded B1 → C1 so the result
 * can place the learner roughly, and each item is tagged with the Grammar Lab
 * topic it samples so weak areas can be prioritised. It is NOT a CEFR exam.
 */
export interface DiagnosticItem extends MultipleChoice {
  band: "B1" | "B2" | "C1";
  topicId?: string;
  section: "grammar" | "vocabulary";
}

export const DIAGNOSTIC_ITEMS: DiagnosticItem[] = [
  { id: "d.g1", section: "grammar", band: "B1", topicId: "present-perfect-vs-past-simple", type: "mcq", prompt: "I _____ the client yesterday morning.", options: ["have called", "called", "was calling to", "have been calling"], answer: 1, explanation: "Finished time (yesterday) → past simple." },
  { id: "d.g2", section: "grammar", band: "B1", topicId: "articles-determiners", type: "mcq", prompt: "_____ is very important for our company.", options: ["The sustainability", "Sustainability", "A sustainability", "Sustainabilities"], answer: 1, explanation: "General idea, uncountable → no article." },
  { id: "d.g3", section: "grammar", band: "B1", topicId: "question-formation", type: "mcq", prompt: "What time _____?", options: ["the meeting starts", "does the meeting start", "starts the meeting", "does start the meeting"], answer: 1, explanation: "Question word + does + subject + verb." },
  { id: "d.g4", section: "grammar", band: "B1", topicId: "future-forms", type: "mcq", prompt: "I'll call you as soon as I _____ the confirmation.", options: ["will get", "get", "am going to get", "would get"], answer: 1, explanation: "After “as soon as”, use the present for the future." },
  { id: "d.g5", section: "grammar", band: "B2", topicId: "present-perfect-vs-past-simple", type: "mcq", prompt: "We _____ with this supplier since 2019.", options: ["work", "are working", "have been working", "worked"], answer: 2, explanation: "Situation continuing up to now with since → present perfect (continuous)." },
  { id: "d.g6", section: "grammar", band: "B2", topicId: "conditionals", type: "mcq", prompt: "If we _____ earlier, we would have got a better price.", options: ["booked", "had booked", "would book", "have booked"], answer: 1, explanation: "Third conditional: if + past perfect." },
  { id: "d.g7", section: "grammar", band: "B2", topicId: "indirect-questions", type: "mcq", prompt: "Could you tell me where _____?", options: ["is the cloakroom", "the cloakroom is", "does the cloakroom be", "the cloakroom does"], answer: 1, explanation: "Indirect questions use statement word order." },
  { id: "d.g8", section: "grammar", band: "B2", topicId: "gerunds-infinitives", type: "mcq", prompt: "We look forward to _____ you in Genoa.", options: ["welcome", "welcoming", "be welcoming", "have welcomed"], answer: 1, explanation: "look forward to + -ing." },
  { id: "d.g9", section: "grammar", band: "B2", topicId: "deduction-speculation", type: "mcq", prompt: "She isn't answering. She _____ her phone at the hotel.", options: ["must leave", "must have left", "must to leave", "had to left"], answer: 1, explanation: "Past deduction: must have + past participle." },
  { id: "d.g10", section: "grammar", band: "B2", topicId: "reported-speech", type: "mcq", prompt: "The client _____ that the room was too small.", options: ["told", "said us", "told us", "said to us that she"], answer: 2, explanation: "tell + person (told us)." },
  { id: "d.g11", section: "grammar", band: "C1", topicId: "complex-sentences", type: "mcq", prompt: "The speaker cancelled at the last minute, _____ meant we had to change the programme.", options: ["what", "that", "which", "it"], answer: 2, explanation: "which refers back to the whole idea." },
  { id: "d.g12", section: "grammar", band: "C1", topicId: "linking-words", type: "mcq", prompt: "_____ the strike, almost all the delegates arrived on time.", options: ["Although", "Despite of", "In spite of", "However"], answer: 2, explanation: "in spite of / despite + noun; although + clause." },
  { id: "d.v1", section: "vocabulary", band: "B1", type: "mcq", prompt: "More than 300 people _____ the conference last year.", options: ["assisted", "attended", "attended to", "participated"], answer: 1, explanation: "attend an event; “assist” means help." },
  { id: "d.v2", section: "vocabulary", band: "B1", type: "mcq", prompt: "It depends _____ the weather.", options: ["from", "of", "on", "by"], answer: 2, explanation: "depend on." },
  { id: "d.v3", section: "vocabulary", band: "B2", type: "mcq", prompt: "We're running behind _____, so let's skip the coffee break.", options: ["time", "schedule", "agenda", "programme"], answer: 1, explanation: "be running behind schedule = late compared with the plan." },
  { id: "d.v4", section: "vocabulary", band: "B2", type: "mcq", prompt: "“That's a fair point, but I'm not entirely _____.”", options: ["convinced", "agreed", "persuasive", "according"], answer: 0, explanation: "I'm not entirely convinced = polite disagreement." },
  { id: "d.v5", section: "vocabulary", band: "B2", type: "mcq", prompt: "Can we _____ the meeting forward to 9 a.m.?", options: ["put", "bring", "take", "make"], answer: 1, explanation: "bring forward = move earlier." },
  { id: "d.v6", section: "vocabulary", band: "C1", type: "mcq", prompt: "Is there any room for _____ on the price?", options: ["manoeuvre", "movement", "discussion", "negotiate"], answer: 0, explanation: "room for manoeuvre = flexibility." },
];

export const DIAGNOSTIC_WRITING = {
  prompt:
    "A client from London is coming to Genoa for a two-day event you're organising. Write a short email (60–100 words) welcoming them, giving one practical piece of information, and asking one question.",
  minWords: 40,
};

export const DIAGNOSTIC_SPEAKING = {
  prompt:
    "Describe a recent event or project at work: what it was, what went well, and one thing you would do differently. Speak (if your browser supports it) or type as you would speak — don't edit too much. Aim for 60 seconds or about 80 words.",
  minWords: 30,
};

export const SELF_ASSESSMENT_SKILLS = [
  { id: "speaking", label: "Speaking spontaneously" },
  { id: "writing", label: "Writing naturally" },
  { id: "vocabulary", label: "Finding the right words" },
  { id: "grammar", label: "Grammar accuracy" },
  { id: "listening", label: "Understanding spoken English" },
  { id: "reading", label: "Reading" },
] as const;
