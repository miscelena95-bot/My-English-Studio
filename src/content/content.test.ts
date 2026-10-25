import { describe, expect, it } from "vitest";
import { VOCAB_SETS } from "./vocabulary";
import { GRAMMAR_TOPICS, topicExercises } from "./grammar";
import { REAL_ENGLISH_UNITS } from "./real-english";
import { DIAGNOSTIC_ITEMS } from "./diagnostic";
import { gradeExercise } from "@/lib/exercises/grade";
import type { Exercise, ExerciseResponse } from "@/lib/exercises/types";
import { canonical, containsPhrase } from "@/lib/domain/text";
import { buildVocabExercise, gapFromExamples, phraseCore, VOCAB_EXERCISE_MODES, type VocabLike } from "@/lib/exercises/vocab";
import { getLibraryEntry, libraryKey } from "./vocabulary";
import { CATEGORY_TOPICS, MISTAKE_CATEGORIES } from "@/lib/domain/mistake-categories";

export const allExercises: Array<{ where: string; ex: Exercise }> = [
  ...VOCAB_SETS.flatMap((s) => s.exercises.map((ex) => ({ where: `vocab:${s.id}`, ex }))),
  ...GRAMMAR_TOPICS.flatMap((t) => topicExercises(t).map((ex) => ({ where: `grammar:${t.id}`, ex }))),
  ...REAL_ENGLISH_UNITS.flatMap((u) => [...u.comprehension, ...u.practice].map((ex) => ({ where: `real:${u.id}`, ex }))),
  ...DIAGNOSTIC_ITEMS.map((ex) => ({ where: "diagnostic", ex })),
];

function correctResponses(ex: Exercise): ExerciseResponse[] {
  switch (ex.type) {
    case "mcq":
      return (Array.isArray(ex.answer) ? ex.answer : [ex.answer]).map((index) => ({ kind: "choice", index }));
    case "gap":
      return ex.answers.map((value) => ({ kind: "text", value }));
    case "match":
      return [{ kind: "match", rightForLeft: ex.pairs.map((p) => p.right) }];
    case "order":
      return [{ kind: "order", sequence: ex.answers[0].replace(/[.?!]$/, "").split(" ") }];
    case "produce":
      return [];
    default:
      return ex.answers.map((value) => ({ kind: "text", value }));
  }
}

export function validateExercise(ex: Exercise): string[] {
  const errs: string[] = [];
  if (!ex.explanation && ex.type !== "match") errs.push("missing explanation");
  if (ex.category && !(MISTAKE_CATEGORIES as readonly string[]).includes(ex.category)) errs.push(`unknown category ${ex.category}`);
  if (ex.type === "gap" && ex.text.split("___").length !== 2) errs.push("gap text must contain exactly one ___");
  if (ex.type === "mcq") {
    const idx = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
    if (idx.some((i) => i < 0 || i >= ex.options.length)) errs.push("mcq answer out of range");
    if (new Set(ex.options).size !== ex.options.length) errs.push("duplicate mcq options");
  }
  if (ex.type === "order") {
    const fromTiles = canonical(ex.words.join(" "));
    const sortedTiles = fromTiles.split(" ").sort().join(" ");
    if (canonical(ex.answers[0]).split(" ").sort().join(" ") !== sortedTiles) errs.push("order tiles don't form the answer");
  }
  if (ex.type === "match" && new Set(ex.pairs.map((p) => p.right)).size !== ex.pairs.length) errs.push("duplicate match targets");
  if (ex.type === "transform" || ex.type === "correct" || ex.type === "rephrase" || ex.type === "formality") {
    const t = ex;
    if (!t.answers.length) errs.push("no answers");
    if (t.type === "correct" && t.answers.some((a) => canonical(a) === canonical(t.source))) errs.push("correction answer equals source");
    if (t.keyword && t.answers.some((a) => !containsPhrase(a, t.keyword!))) errs.push(`answer missing keyword ${t.keyword}`);
    for (const m of t.mustInclude ?? []) if (t.answers.some((a) => !containsPhrase(a, m, { exact: true }))) errs.push(`answer missing mustInclude ${m}`);
  }
  if (ex.type === "produce") {
    for (const m of ex.modelAnswers) {
      const r = gradeExercise(ex, { kind: "text", value: m });
      if (r.status !== "unverified") errs.push(`model answer fails own check: "${m}" (${r.message})`);
    }
  }
  for (const res of correctResponses(ex)) {
    const r = gradeExercise(ex, res);
    if (r.status !== "correct") errs.push(`listed answer not graded correct: ${JSON.stringify(res)} → ${r.status}`);
  }
  return errs;
}

describe("content integrity", () => {
  it("has unique exercise ids", () => {
    const ids = allExercises.map((e) => e.ex.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("every exercise is internally consistent", () => {
    const problems = allExercises.flatMap(({ where, ex }) => validateExercise(ex).map((e) => `${where} ${ex.id}: ${e}`));
    expect(problems).toEqual([]);
  });

  it("every vocabulary entry can generate all exercise modes", () => {
    const problems: string[] = [];
    const pool: VocabLike[] = VOCAB_SETS.flatMap((s) => s.entries.map((e) => ({ ...e, key: libraryKey(s.id, e.id) })));
    for (const set of VOCAB_SETS) {
      const ids = new Set<string>();
      for (const e of set.entries) {
        if (ids.has(e.id)) problems.push(`${set.id}: duplicate entry ${e.id}`);
        ids.add(e.id);
        const v: VocabLike = { ...e, key: libraryKey(set.id, e.id) };
        if (!gapFromExamples(v)) problems.push(`${set.id}.${e.id}: no example contains "${phraseCore(e.phrase)}" or a listed form`);
        if (!e.examples.some((x) => containsPhrase(x, phraseCore(e.phrase)) || (e.forms ?? []).some((f) => containsPhrase(x, f))))
          problems.push(`${set.id}.${e.id}: examples don't use the phrase`);
        for (const mode of VOCAB_EXERCISE_MODES) {
          const ex = buildVocabExercise(v, mode, pool);
          problems.push(...validateExercise(ex).map((m) => `${set.id}.${e.id} [${mode}]: ${m}`));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("grammar tasks' model answers satisfy their own checks", () => {
    const problems: string[] = [];
    for (const t of GRAMMAR_TOPICS) {
      for (const l of t.task.lookFor) {
        const m = ` ${t.task.modelAnswer.toLowerCase()} `;
        if (!l.anyOf.some((w) => m.includes(w.toLowerCase()))) problems.push(`${t.id}: model answer lacks ${l.label}`);
      }
      if (t.guided.length < 3 || t.independent.length < 3) problems.push(`${t.id}: needs at least 3 guided and 3 independent items`);
    }
    expect(problems).toEqual([]);
  });

  it("real English units have objectives, sources and attribution", () => {
    const problems: string[] = [];
    for (const u of REAL_ENGLISH_UNITS) {
      if (!u.objective) problems.push(`${u.id}: no objective`);
      if (!u.source.note) problems.push(`${u.id}: no attribution note`);
      if (u.source.kind !== "your-choice" && !u.source.paragraphs?.length) problems.push(`${u.id}: no text`);
      if (u.source.url && !/^https:\/\//.test(u.source.url)) problems.push(`${u.id}: link must be https`);
      for (const k of u.keyExpressions) if (k.libraryKey && !getLibraryEntry(k.libraryKey)) problems.push(`${u.id}: unknown library key ${k.libraryKey}`);
    }
    expect(problems).toEqual([]);
  });

  it("mistake categories point at real grammar topics", () => {
    const ids = new Set(GRAMMAR_TOPICS.map((t) => t.id));
    const missing = Object.values(CATEGORY_TOPICS).flat().filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });
});

import { PATH_LESSONS } from "./path";
import { getScenario, SCENARIOS, FLUENCY_DRILLS } from "./speaking/scenarios";
import { getWritingTask, WRITING_TASKS } from "./writing/tasks";
import { getVocabSet } from "./vocabulary";
import { getGrammarTopic } from "./grammar";
import { getUnit } from "./real-english";

describe("cross references", () => {
  it("path lessons point at existing content", () => {
    const problems: string[] = [];
    for (const l of PATH_LESSONS)
      for (const s of l.steps) {
        const ok =
          s.kind === "vocab" ? getVocabSet(s.setId) : s.kind === "grammar" ? getGrammarTopic(s.topicId) : s.kind === "speaking" ? getScenario(s.scenarioId) : s.kind === "writing" ? getWritingTask(s.taskId) : getUnit(s.unitId);
        if (!ok) problems.push(`${l.id}: missing ${JSON.stringify(s)}`);
      }
    expect(problems).toEqual([]);
  });
  it("scenarios, tasks and topics reference existing content and have unique ids", () => {
    const problems: string[] = [];
    const ids = [...SCENARIOS.map((s) => s.id), ...WRITING_TASKS.map((t) => t.id), ...FLUENCY_DRILLS.map((d) => d.id)];
    if (new Set(ids).size !== ids.length) problems.push("duplicate ids");
    for (const s of SCENARIOS) {
      if (s.grammarFocus && !getGrammarTopic(s.grammarFocus)) problems.push(`${s.id}: grammar ${s.grammarFocus}`);
      if (s.vocabSet && !getVocabSet(s.vocabSet)) problems.push(`${s.id}: vocab ${s.vocabSet}`);
    }
    for (const t of WRITING_TASKS) if (t.grammarFocus && !getGrammarTopic(t.grammarFocus)) problems.push(`${t.id}: grammar ${t.grammarFocus}`);
    for (const t of GRAMMAR_TOPICS) {
      if (t.task.speakingScenarioId && !getScenario(t.task.speakingScenarioId)) problems.push(`${t.id}: scenario ${t.task.speakingScenarioId}`);
      if (t.relatedVocabSet && !getVocabSet(t.relatedVocabSet)) problems.push(`${t.id}: vocab ${t.relatedVocabSet}`);
    }
    expect(problems).toEqual([]);
  });
});
