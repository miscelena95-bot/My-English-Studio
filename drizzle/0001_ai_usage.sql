CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`model` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `model`)
);
