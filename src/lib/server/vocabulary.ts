import "server-only";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getLibraryEntry, getVocabSet, findLibraryEntryByPhrase, libraryKey, VOCAB_SETS } from "@/content/vocabulary";
import { newReviewState, nextReviewMode, scheduleReview, type Rating, type ReviewMode } from "@/lib/domain/srs";
import type { VocabLike } from "@/lib/exercises/vocab";
import { containsPhrase } from "@/lib/domain/text";
import { phraseCore } from "@/lib/exercises/vocab";
import type { CustomVocabInput } from "@/lib/validation/vocab";

export type VocabEntry = typeof schema.vocabEntries.$inferSelect;
export type ReviewSchedule = typeof schema.reviewSchedules.$inferSelect;
export type VocabWithSchedule = VocabEntry & { schedule: ReviewSchedule | null };

function insertSchedule(vocabId: number) {
  const s = newReviewState(new Date());
  getDb()
    .insert(schema.reviewSchedules)
    .values({ vocabId, ...s })
    .onConflictDoNothing()
    .run();
}

export function findByPhrase(phrase: string) {
  return getDb()
    .select()
    .from(schema.vocabEntries)
    .where(sql`lower(${schema.vocabEntries.phrase}) = lower(${phrase.trim()})`)
    .get();
}

/** Save a built-in expression to the personal collection (idempotent). */
export function addFromLibrary(key: string, source = "seed", sourceRef?: string) {
  const found = getLibraryEntry(key);
  if (!found) throw new Error(`Unknown expression: ${key}`);
  const { set, entry } = found;
  const existing = findByPhrase(entry.phrase);
  if (existing) {
    if (existing.archived) getDb().update(schema.vocabEntries).set({ archived: false }).where(eq(schema.vocabEntries.id, existing.id)).run();
    insertSchedule(existing.id);
    return { id: existing.id, created: false };
  }
  const row = getDb()
    .insert(schema.vocabEntries)
    .values({
      libraryId: key,
      phrase: entry.phrase,
      partOfSpeech: entry.pos,
      definition: entry.definition,
      examples: entry.examples,
      collocations: entry.collocations ?? [],
      synonyms: entry.synonyms ?? [],
      register: [entry.register, entry.registerNote].filter(Boolean).join(" — ") || null,
      pronunciation: entry.stress ?? null,
      ipa: entry.ipa ?? null,
      commonMistakes: entry.mistakes ?? [],
      italianNote: entry.italian ?? null,
      contextNote: entry.context ?? null,
      tags: [set.title],
      source,
      sourceRef: sourceRef ?? set.id,
      setId: set.id,
    })
    .returning({ id: schema.vocabEntries.id })
    .get();
  insertSchedule(row.id);
  return { id: row.id, created: true };
}

export function addSet(setId: string) {
  const set = getVocabSet(setId);
  if (!set) throw new Error("Unknown set");
  return set.entries.map((e) => addFromLibrary(libraryKey(set.id, e.id), "seed", set.id));
}

/** Add an expression the learner typed or saved from feedback. Enriches it from the library when possible. */
export function addCustom(input: CustomVocabInput) {
  const lib = findLibraryEntryByPhrase(input.phrase);
  if (lib) return addFromLibrary(lib.key, input.source, input.sourceRef ?? undefined);
  const existing = findByPhrase(input.phrase);
  if (existing) {
    if (existing.archived) getDb().update(schema.vocabEntries).set({ archived: false }).where(eq(schema.vocabEntries.id, existing.id)).run();
    return { id: existing.id, created: false };
  }
  const row = getDb()
    .insert(schema.vocabEntries)
    .values({
      phrase: input.phrase,
      partOfSpeech: input.partOfSpeech,
      definition: input.definition,
      examples: input.examples,
      collocations: input.collocations,
      synonyms: input.synonyms,
      register: input.register,
      commonMistakes: [],
      personalNotes: input.personalNotes,
      tags: [],
      source: input.source,
      sourceRef: input.sourceRef ?? null,
    })
    .returning({ id: schema.vocabEntries.id })
    .get();
  insertSchedule(row.id);
  return { id: row.id, created: true };
}

export function getEntry(id: number): VocabWithSchedule | undefined {
  const db = getDb();
  const e = db.select().from(schema.vocabEntries).where(eq(schema.vocabEntries.id, id)).get();
  if (!e) return undefined;
  const s = db.select().from(schema.reviewSchedules).where(eq(schema.reviewSchedules.vocabId, id)).get() ?? null;
  return { ...e, schedule: s };
}

export function reviewHistory(id: number) {
  return getDb().select().from(schema.reviewLogs).where(eq(schema.reviewLogs.vocabId, id)).orderBy(desc(schema.reviewLogs.createdAt)).limit(20).all();
}

export function listCollection(): VocabWithSchedule[] {
  const rows = getDb()
    .select()
    .from(schema.vocabEntries)
    .leftJoin(schema.reviewSchedules, eq(schema.reviewSchedules.vocabId, schema.vocabEntries.id))
    .where(eq(schema.vocabEntries.archived, false))
    .orderBy(desc(schema.vocabEntries.createdAt))
    .all();
  return rows.map((r) => ({ ...r.vocab_entries, schedule: r.review_schedules }));
}

export function dueEntries(now = new Date(), limit = 50): VocabWithSchedule[] {
  const rows = getDb()
    .select()
    .from(schema.vocabEntries)
    .innerJoin(schema.reviewSchedules, eq(schema.reviewSchedules.vocabId, schema.vocabEntries.id))
    .where(and(eq(schema.vocabEntries.archived, false), lte(schema.reviewSchedules.dueAt, now)))
    .orderBy(asc(schema.reviewSchedules.dueAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...r.vocab_entries, schedule: r.review_schedules }));
}

export function dueCount(now = new Date()): number {
  const r = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(schema.reviewSchedules)
    .innerJoin(schema.vocabEntries, eq(schema.reviewSchedules.vocabId, schema.vocabEntries.id))
    .where(and(eq(schema.vocabEntries.archived, false), lte(schema.reviewSchedules.dueAt, now)))
    .get();
  return Number(r?.n ?? 0);
}

export function recordReview(vocabId: number, input: { rating: Rating; mode: ReviewMode; exerciseType?: string; difficulty?: 1 | 2 | 3 }) {
  const db = getDb();
  const now = new Date();
  let s = db.select().from(schema.reviewSchedules).where(eq(schema.reviewSchedules.vocabId, vocabId)).get();
  if (!s) {
    insertSchedule(vocabId);
    s = db.select().from(schema.reviewSchedules).where(eq(schema.reviewSchedules.vocabId, vocabId)).get()!;
  }
  const next = scheduleReview(
    { ...s, mastery: s.mastery as "new" | "learning" | "reviewing" | "mastered" },
    { rating: input.rating, mode: input.mode, difficulty: input.difficulty, now },
  );
  db.update(schema.reviewSchedules).set(next).where(eq(schema.reviewSchedules.vocabId, vocabId)).run();
  db.insert(schema.reviewLogs)
    .values({ vocabId, rating: input.rating, mode: input.mode, exerciseType: input.exerciseType ?? null, previousInterval: s.intervalDays, newInterval: next.intervalDays, createdAt: now })
    .run();
  return next;
}

export function updateEntry(id: number, patch: Partial<Pick<VocabEntry, "personalNotes" | "archived" | "definition">>) {
  getDb().update(schema.vocabEntries).set(patch).where(eq(schema.vocabEntries.id, id)).run();
}

export function deleteEntry(id: number) {
  getDb().delete(schema.vocabEntries).where(eq(schema.vocabEntries.id, id)).run();
}

export function toVocabLike(e: VocabEntry): VocabLike {
  const lib = e.libraryId ? getLibraryEntry(e.libraryId) : undefined;
  return {
    key: e.libraryId ?? `db${e.id}`,
    phrase: e.phrase,
    definition: e.definition,
    examples: e.examples,
    forms: lib?.entry.forms,
    italian: e.italianNote,
    mistakes: e.commonMistakes,
  };
}

/** Static distractor pool: all library entries (keeps generated exercises reproducible). */
export const LIBRARY_POOL: VocabLike[] = VOCAB_SETS.flatMap((s) =>
  s.entries.map((e) => ({ key: libraryKey(s.id, e.id), phrase: e.phrase, definition: e.definition, examples: e.examples, forms: e.forms, italian: e.italian, mistakes: e.mistakes })),
);

export function reviewModeFor(e: VocabWithSchedule): ReviewMode {
  return e.schedule ? nextReviewMode({ mastery: e.schedule.mastery as never, repetitions: e.schedule.repetitions, lapses: e.schedule.lapses }) : "recognition";
}

/**
 * Detect which saved expressions the learner actually used in their own
 * speaking or writing, and count it. This is how "active vocabulary" is measured.
 */
export function markUsedExpressions(text: string): VocabEntry[] {
  const db = getDb();
  const used: VocabEntry[] = [];
  const entries = db.select().from(schema.vocabEntries).where(eq(schema.vocabEntries.archived, false)).all();
  for (const e of entries) {
    const lib = e.libraryId ? getLibraryEntry(e.libraryId) : undefined;
    const core = phraseCore(e.phrase);
    if (core.split(" ").length < 2 && core.length < 5) continue; // too short to detect reliably
    if (containsPhrase(text, core) || (lib?.entry.forms ?? []).some((f) => f.split(" ").length > 1 && containsPhrase(text, f))) {
      db.update(schema.vocabEntries)
        .set({ timesUsed: e.timesUsed + 1, lastUsedAt: new Date() })
        .where(eq(schema.vocabEntries.id, e.id))
        .run();
      used.push(e);
    }
  }
  return used;
}

export function collectionStats(now = new Date()) {
  const all = listCollection();
  const by = (m: string) => all.filter((e) => e.schedule?.mastery === m).length;
  return {
    total: all.length,
    due: all.filter((e) => e.schedule && e.schedule.dueAt <= now).length,
    new: by("new"),
    learning: by("learning"),
    reviewing: by("reviewing"),
    mastered: by("mastered"),
    usedActively: all.filter((e) => e.timesUsed > 0).length,
  };
}
