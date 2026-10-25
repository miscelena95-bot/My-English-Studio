import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * Data model for My English Studio.
 *
 * The app is a single-learner prototype, but every table is keyed so that a
 * `learnerId` column could be added later without restructuring. JSON columns
 * hold small, schema-validated structures (see src/lib/validation).
 */

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
};

// ---------------------------------------------------------------- learner

export const learnerProfile = sqliteTable("learner_profile", {
  id: integer("id").primaryKey(),
  name: text("name"),
  selfAssessedLevel: text("self_assessed_level").notNull().default("B1+"),
  /** Provisional estimate from diagnostic + ongoing performance. Never a certificate. */
  estimatedLevel: text("estimated_level"),
  levelEvidence: text("level_evidence", { mode: "json" }).$type<string[]>(),
  goals: text("goals", { mode: "json" }).$type<string[]>().notNull(),
  sessionMinutes: integer("session_minutes").notNull().default(25),
  correctionStyle: text("correction_style").notNull().default("adaptive"),
  interests: text("interests", { mode: "json" }).$type<string[]>().notNull(),
  professionalFocus: text("professional_focus", { mode: "json" }).$type<string[]>().notNull(),
  structureBalance: text("structure_balance").notNull().default("mixed"),
  speakingMode: text("speaking_mode").notNull().default("both"),
  weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(150),
  weeklyGoalSessions: integer("weekly_goal_sessions").notNull().default(5),
  showStreak: integer("show_streak", { mode: "boolean" }).notNull().default(true),
  /** A break keeps all history but pauses reminders/streak expectations. */
  breakUntil: text("break_until"),
  storeTranscripts: integer("store_transcripts", { mode: "boolean" }).notNull().default(true),
  voiceName: text("voice_name"),
  speechRate: real("speech_rate").notNull().default(0.95),
  onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp_ms" }),
  diagnosticCompletedAt: integer("diagnostic_completed_at", { mode: "timestamp_ms" }),
  ...timestamps,
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const diagnosticResults = sqliteTable("diagnostic_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grammarCorrect: integer("grammar_correct").notNull(),
  grammarTotal: integer("grammar_total").notNull(),
  vocabCorrect: integer("vocab_correct").notNull(),
  vocabTotal: integer("vocab_total").notNull(),
  answers: text("answers", { mode: "json" }).$type<Record<string, string>>().notNull(),
  writingSample: text("writing_sample"),
  writingAssessment: text("writing_assessment", { mode: "json" }).$type<unknown>(),
  speakingSample: text("speaking_sample"),
  speakingAssessment: text("speaking_assessment", { mode: "json" }).$type<unknown>(),
  selfAssessment: text("self_assessment", { mode: "json" }).$type<Record<string, number>>().notNull(),
  estimatedLevel: text("estimated_level").notNull(),
  weakTopics: text("weak_topics", { mode: "json" }).$type<string[]>().notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------- activity log

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** e.g. vocab-review, vocab-practice, grammar-practice, writing, speaking, fluency, real-english, mistake-review, diagnostic, challenge */
    kind: text("kind").notNull(),
    skill: text("skill").notNull(),
    refId: text("ref_id"),
    title: text("title").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /** Measured active time in seconds (capped per activity to avoid idle tabs inflating it). */
    durationSec: integer("duration_sec").notNull().default(0),
    itemsTotal: integer("items_total").notNull().default(0),
    itemsCorrect: integer("items_correct").notNull().default(0),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [index("activities_started_idx").on(t.startedAt), index("activities_kind_idx").on(t.kind, t.refId)],
);

export const exerciseAttempts = sqliteTable(
  "exercise_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    activityId: integer("activity_id").references(() => activities.id, { onDelete: "set null" }),
    exerciseId: text("exercise_id").notNull(),
    exerciseType: text("exercise_type").notNull(),
    skill: text("skill").notNull(),
    /** grammar topic id, vocabulary set id, or "mistakes" */
    topicId: text("topic_id"),
    response: text("response").notNull(),
    /** correct | incorrect | close | unverified | self-accepted */
    status: text("status").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    difficulty: integer("difficulty").notNull().default(2),
    ...timestamps,
  },
  (t) => [index("attempts_topic_idx").on(t.topicId), index("attempts_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------- vocabulary

export const vocabEntries = sqliteTable(
  "vocab_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Library id when the entry comes from built-in content (e.g. "opinions.as-far-as-im-concerned"). */
    libraryId: text("library_id"),
    phrase: text("phrase").notNull(),
    partOfSpeech: text("part_of_speech"),
    definition: text("definition").notNull(),
    examples: text("examples", { mode: "json" }).$type<string[]>().notNull(),
    collocations: text("collocations", { mode: "json" }).$type<string[]>().notNull(),
    synonyms: text("synonyms", { mode: "json" }).$type<string[]>().notNull(),
    register: text("register"),
    pronunciation: text("pronunciation"),
    ipa: text("ipa"),
    commonMistakes: text("common_mistakes", { mode: "json" }).$type<string[]>().notNull(),
    italianNote: text("italian_note"),
    contextNote: text("context_note"),
    personalNotes: text("personal_notes"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    /** seed | grammar | speaking | writing | real-english | manual | mistakes */
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    setId: text("set_id"),
    /** Times the learner used this expression in their own production (speaking/writing). */
    timesUsed: integer("times_used").notNull().default(0),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("vocab_phrase_unique").on(t.phrase)],
);

export const reviewSchedules = sqliteTable("review_schedules", {
  vocabId: integer("vocab_id")
    .primaryKey()
    .references(() => vocabEntries.id, { onDelete: "cascade" }),
  ease: real("ease").notNull().default(2.3),
  intervalDays: real("interval_days").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  successfulRecalls: integer("successful_recalls").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  /** new | learning | reviewing | mastered */
  mastery: text("mastery").notNull().default("new"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
});

export const reviewLogs = sqliteTable(
  "review_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vocabId: integer("vocab_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    mode: text("mode").notNull(),
    exerciseType: text("exercise_type"),
    previousInterval: real("previous_interval").notNull(),
    newInterval: real("new_interval").notNull(),
    ...timestamps,
  },
  (t) => [index("review_logs_vocab_idx").on(t.vocabId)],
);

// ---------------------------------------------------------------- grammar

export const grammarProgress = sqliteTable("grammar_progress", {
  topicId: text("topic_id").primaryKey(),
  lessonOpenedAt: integer("lesson_opened_at", { mode: "timestamp_ms" }),
  lessonCompletedAt: integer("lesson_completed_at", { mode: "timestamp_ms" }),
  taskResponse: text("task_response"),
  taskCompletedAt: integer("task_completed_at", { mode: "timestamp_ms" }),
  /** Learner says "I understand this but can't use it spontaneously". */
  flaggedForSpeaking: integer("flagged_for_speaking", { mode: "boolean" }).notNull().default(false),
});

// ---------------------------------------------------------------- speaking

export const conversationSessions = sqliteTable("conversation_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scenarioId: text("scenario_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  /** text | voice */
  inputMode: text("input_mode").notNull().default("text"),
  /** fluency | coaching | precision */
  correctionMode: text("correction_mode").notNull(),
  challengeMode: integer("challenge_mode", { mode: "boolean" }).notNull().default(false),
  customTopic: text("custom_topic"),
  activityId: integer("activity_id"),
  targetExpressions: text("target_expressions", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status").notNull().default("active"),
  learnerTurns: integer("learner_turns").notNull().default(0),
  learnerWords: integer("learner_words").notNull().default(0),
  hintsUsed: integer("hints_used").notNull().default(0),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
});

export const conversationMessages = sqliteTable(
  "conversation_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => conversationSessions.id, { onDelete: "cascade" }),
    /** learner | tutor */
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** typed | spoken */
    inputMode: text("input_mode"),
    /** Inline corrections shown at a natural pause (coaching/precision). */
    feedback: text("feedback", { mode: "json" }).$type<unknown>(),
    /** True when the learner repeated an answer after feedback. */
    isRetry: integer("is_retry", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("messages_session_idx").on(t.sessionId)],
);

export const conversationReports = sqliteTable("conversation_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => conversationSessions.id, { onDelete: "cascade" }),
  report: text("report", { mode: "json" }).$type<unknown>().notNull(),
  followUpDone: integer("follow_up_done", { mode: "boolean" }).notNull().default(false),
  followUpResponse: text("follow_up_response"),
  ...timestamps,
});

// ---------------------------------------------------------------- writing

export const writingSubmissions = sqliteTable("writing_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").notNull(),
  title: text("title").notNull(),
  /** draft | feedback | revised */
  status: text("status").notNull().default("draft"),
  activityId: integer("activity_id"),
  ...timestamps,
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const writingDrafts = sqliteTable(
  "writing_drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => writingSubmissions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    text: text("text").notNull(),
    wordCount: integer("word_count").notNull(),
    feedback: text("feedback", { mode: "json" }).$type<unknown>(),
    /** ai | checklist */
    feedbackSource: text("feedback_source"),
    selfReview: text("self_review", { mode: "json" }).$type<Record<string, boolean>>(),
    ...timestamps,
  },
  (t) => [index("drafts_submission_idx").on(t.submissionId)],
);

// ---------------------------------------------------------------- mistakes

export const mistakes = sqliteTable(
  "mistakes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    original: text("original").notNull(),
    corrected: text("corrected").notNull(),
    explanation: text("explanation").notNull(),
    /** grammar | vocabulary | collocation | word-order | articles | prepositions | verb-tense | register | naturalness | spelling | sentence-structure */
    category: text("category").notNull(),
    /** Normalised pattern used to group repeated mistakes, e.g. "prepositions:depend-on". */
    patternKey: text("pattern_key").notNull(),
    /** error | unnatural | style */
    severity: text("severity").notNull().default("error"),
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    context: text("context"),
    grammarTopicId: text("grammar_topic_id"),
    occurrences: integer("occurrences").notNull().default(1),
    /** active | improving | resolved */
    status: text("status").notNull().default("active"),
    practiceCount: integer("practice_count").notNull().default(0),
    practiceCorrect: integer("practice_correct").notNull().default(0),
    consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at", { mode: "timestamp_ms" }),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("mistakes_pattern_idx").on(t.patternKey), index("mistakes_status_idx").on(t.status)],
);

export const mistakeEvents = sqliteTable(
  "mistake_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mistakeId: integer("mistake_id")
      .notNull()
      .references(() => mistakes.id, { onDelete: "cascade" }),
    /** occurred | practised-correct | practised-incorrect */
    type: text("type").notNull(),
    text: text("text"),
    source: text("source"),
    ...timestamps,
  },
  (t) => [index("mistake_events_idx").on(t.mistakeId)],
);

// ---------------------------------------------------------------- sessions & content

export const dailySessions = sqliteTable("daily_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  minutes: integer("minutes").notNull(),
  plan: text("plan", { mode: "json" }).$type<unknown>().notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  reflection: text("reflection", { mode: "json" }).$type<{ difficulty?: string; note?: string }>(),
});

export const contentProgress = sqliteTable("content_progress", {
  contentId: text("content_id").primaryKey(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  stepsDone: text("steps_done", { mode: "json" }).$type<string[]>().notNull(),
  answers: text("answers", { mode: "json" }).$type<Record<string, string>>().notNull(),
});

/** Learner-added authentic resources (articles, podcasts, videos) plus cached news items. */
export const contentResources = sqliteTable("content_resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  sourceName: text("source_name"),
  publishedAt: text("published_at"),
  summary: text("summary"),
  /** Text used to build activities (not displayed in full). */
  sourceText: text("source_text"),
  externalId: text("external_id"),
  learnerNotes: text("learner_notes"),
  generatedActivity: text("generated_activity", { mode: "json" }).$type<unknown>(),
  ...timestamps,
});

export const progressSnapshots = sqliteTable("progress_snapshots", {
  weekStart: text("week_start").primaryKey(),
  data: text("data", { mode: "json" }).$type<unknown>().notNull(),
  ...timestamps,
});

/** AI requests that reached the provider, per quota day (Pacific time) and model. */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    day: text("day").notNull(),
    model: text("model").notNull(),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.model] })],
);
