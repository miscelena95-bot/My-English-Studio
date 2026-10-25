import type { GrammarTopic } from "./types";
import { futureForms, narrativeTenses, passiveVoice, presentForms, presentPerfect } from "./topics-verbs";
import { conditionals, deduction, modalVerbs, professionalLanguage } from "./topics-modals";
import { articles, countableUncountable, prepositions } from "./topics-nouns";
import { indirectQuestions, questionFormation, relativeClauses, reportedSpeech, wordOrder } from "./topics-sentences";
import { comparatives, complexSentences, gerundsInfinitives, linkingWords } from "./topics-advanced";

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  presentForms,
  presentPerfect,
  narrativeTenses,
  futureForms,
  passiveVoice,
  modalVerbs,
  deduction,
  conditionals,
  articles,
  countableUncountable,
  prepositions,
  questionFormation,
  wordOrder,
  indirectQuestions,
  relativeClauses,
  reportedSpeech,
  gerundsInfinitives,
  comparatives,
  linkingWords,
  complexSentences,
  professionalLanguage,
];

export const GRAMMAR_GROUPS: GrammarTopic["group"][] = [
  "Verb forms",
  "Modals & conditionals",
  "Nouns & determiners",
  "Sentence building",
  "Professional English",
];

export function getGrammarTopic(id: string) {
  return GRAMMAR_TOPICS.find((t) => t.id === id);
}

export function topicExercises(t: GrammarTopic) {
  return [...t.guided, ...t.independent];
}

export type { GrammarTopic };
