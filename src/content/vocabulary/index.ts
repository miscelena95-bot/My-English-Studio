import type { LibraryEntry, VocabSet } from "./types";
import { disagreeing, opinions, storytelling, uncertainty } from "./sets-conversation";
import { emails, meetings, negotiation, presenting, workPhrasalVerbs } from "./sets-professional";
import { eventLogistics, problemsComplaints, smallTalk, welcoming } from "./sets-events";
import { falseFriends, mediaReviews, psychology, travelCulture } from "./sets-culture";

export const VOCAB_SETS: VocabSet[] = [
  opinions,
  disagreeing,
  uncertainty,
  storytelling,
  smallTalk,
  meetings,
  emails,
  negotiation,
  presenting,
  workPhrasalVerbs,
  eventLogistics,
  problemsComplaints,
  welcoming,
  falseFriends,
  psychology,
  travelCulture,
  mediaReviews,
];

export const THEME_LABELS: Record<VocabSet["theme"], string> = {
  conversation: "Conversation",
  professional: "Professional",
  events: "Event organisation",
  language: "Italian-speaker traps",
  culture: "Culture & ideas",
};

export function getVocabSet(id: string) {
  return VOCAB_SETS.find((s) => s.id === id);
}

export function libraryKey(setId: string, entryId: string) {
  return `${setId}.${entryId}`;
}

export function getLibraryEntry(key: string): { set: VocabSet; entry: LibraryEntry } | undefined {
  const [setId, ...rest] = key.split(".");
  const set = getVocabSet(setId);
  const entry = set?.entries.find((e) => e.id === rest.join("."));
  return set && entry ? { set, entry } : undefined;
}

export function allLibraryEntries() {
  return VOCAB_SETS.flatMap((set) => set.entries.map((entry) => ({ set, entry, key: libraryKey(set.id, entry.id) })));
}

/** Find a library entry by phrase (case-insensitive), used to enrich expressions saved from other modules. */
export function findLibraryEntryByPhrase(phrase: string) {
  const p = phrase.trim().toLowerCase();
  return allLibraryEntries().find(({ entry }) => entry.phrase.toLowerCase() === p);
}

export type { LibraryEntry, VocabSet };
