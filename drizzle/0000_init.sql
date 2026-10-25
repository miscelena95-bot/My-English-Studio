CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`skill` text NOT NULL,
	`ref_id` text,
	`title` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`items_total` integer DEFAULT 0 NOT NULL,
	`items_correct` integer DEFAULT 0 NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `activities_started_idx` ON `activities` (`started_at`);--> statement-breakpoint
CREATE INDEX `activities_kind_idx` ON `activities` (`kind`,`ref_id`);--> statement-breakpoint
CREATE TABLE `content_progress` (
	`content_id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`steps_done` text NOT NULL,
	`answers` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`source_name` text,
	`published_at` text,
	`summary` text,
	`source_text` text,
	`external_id` text,
	`learner_notes` text,
	`generated_activity` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`input_mode` text,
	`feedback` text,
	`is_retry` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `conversation_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_session_idx` ON `conversation_messages` (`session_id`);--> statement-breakpoint
CREATE TABLE `conversation_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`report` text NOT NULL,
	`follow_up_done` integer DEFAULT false NOT NULL,
	`follow_up_response` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `conversation_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversation_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scenario_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`input_mode` text DEFAULT 'text' NOT NULL,
	`correction_mode` text NOT NULL,
	`challenge_mode` integer DEFAULT false NOT NULL,
	`custom_topic` text,
	`activity_id` integer,
	`target_expressions` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`learner_turns` integer DEFAULT 0 NOT NULL,
	`learner_words` integer DEFAULT 0 NOT NULL,
	`hints_used` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `daily_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`minutes` integer NOT NULL,
	`plan` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`reflection` text
);
--> statement-breakpoint
CREATE TABLE `diagnostic_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grammar_correct` integer NOT NULL,
	`grammar_total` integer NOT NULL,
	`vocab_correct` integer NOT NULL,
	`vocab_total` integer NOT NULL,
	`answers` text NOT NULL,
	`writing_sample` text,
	`writing_assessment` text,
	`speaking_sample` text,
	`speaking_assessment` text,
	`self_assessment` text NOT NULL,
	`estimated_level` text NOT NULL,
	`weak_topics` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity_id` integer,
	`exercise_id` text NOT NULL,
	`exercise_type` text NOT NULL,
	`skill` text NOT NULL,
	`topic_id` text,
	`response` text NOT NULL,
	`status` text NOT NULL,
	`is_correct` integer,
	`difficulty` integer DEFAULT 2 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attempts_topic_idx` ON `exercise_attempts` (`topic_id`);--> statement-breakpoint
CREATE INDEX `attempts_created_idx` ON `exercise_attempts` (`created_at`);--> statement-breakpoint
CREATE TABLE `grammar_progress` (
	`topic_id` text PRIMARY KEY NOT NULL,
	`lesson_opened_at` integer,
	`lesson_completed_at` integer,
	`task_response` text,
	`task_completed_at` integer,
	`flagged_for_speaking` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learner_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`self_assessed_level` text DEFAULT 'B1+' NOT NULL,
	`estimated_level` text,
	`level_evidence` text,
	`goals` text NOT NULL,
	`session_minutes` integer DEFAULT 25 NOT NULL,
	`correction_style` text DEFAULT 'adaptive' NOT NULL,
	`interests` text NOT NULL,
	`professional_focus` text NOT NULL,
	`structure_balance` text DEFAULT 'mixed' NOT NULL,
	`speaking_mode` text DEFAULT 'both' NOT NULL,
	`weekly_goal_minutes` integer DEFAULT 150 NOT NULL,
	`weekly_goal_sessions` integer DEFAULT 5 NOT NULL,
	`show_streak` integer DEFAULT true NOT NULL,
	`break_until` text,
	`store_transcripts` integer DEFAULT true NOT NULL,
	`voice_name` text,
	`speech_rate` real DEFAULT 0.95 NOT NULL,
	`onboarding_completed_at` integer,
	`diagnostic_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mistake_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mistake_id` integer NOT NULL,
	`type` text NOT NULL,
	`text` text,
	`source` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mistake_events_idx` ON `mistake_events` (`mistake_id`);--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original` text NOT NULL,
	`corrected` text NOT NULL,
	`explanation` text NOT NULL,
	`category` text NOT NULL,
	`pattern_key` text NOT NULL,
	`severity` text DEFAULT 'error' NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`context` text,
	`grammar_topic_id` text,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`practice_count` integer DEFAULT 0 NOT NULL,
	`practice_correct` integer DEFAULT 0 NOT NULL,
	`consecutive_correct` integer DEFAULT 0 NOT NULL,
	`last_practiced_at` integer,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `mistakes_pattern_idx` ON `mistakes` (`pattern_key`);--> statement-breakpoint
CREATE INDEX `mistakes_status_idx` ON `mistakes` (`status`);--> statement-breakpoint
CREATE TABLE `progress_snapshots` (
	`week_start` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vocab_id` integer NOT NULL,
	`rating` text NOT NULL,
	`mode` text NOT NULL,
	`exercise_type` text,
	`previous_interval` real NOT NULL,
	`new_interval` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`vocab_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_logs_vocab_idx` ON `review_logs` (`vocab_id`);--> statement-breakpoint
CREATE TABLE `review_schedules` (
	`vocab_id` integer PRIMARY KEY NOT NULL,
	`ease` real DEFAULT 2.3 NOT NULL,
	`interval_days` real DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`successful_recalls` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`mastery` text DEFAULT 'new' NOT NULL,
	`due_at` integer NOT NULL,
	`last_reviewed_at` integer,
	FOREIGN KEY (`vocab_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vocab_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` text,
	`phrase` text NOT NULL,
	`part_of_speech` text,
	`definition` text NOT NULL,
	`examples` text NOT NULL,
	`collocations` text NOT NULL,
	`synonyms` text NOT NULL,
	`register` text,
	`pronunciation` text,
	`ipa` text,
	`common_mistakes` text NOT NULL,
	`italian_note` text,
	`context_note` text,
	`personal_notes` text,
	`tags` text NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`set_id` text,
	`times_used` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_phrase_unique` ON `vocab_entries` (`phrase`);--> statement-breakpoint
CREATE TABLE `writing_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`version` integer NOT NULL,
	`text` text NOT NULL,
	`word_count` integer NOT NULL,
	`feedback` text,
	`feedback_source` text,
	`self_review` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `writing_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drafts_submission_idx` ON `writing_drafts` (`submission_id`);--> statement-breakpoint
CREATE TABLE `writing_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`activity_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
