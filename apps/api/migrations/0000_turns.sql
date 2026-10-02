CREATE TABLE `turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`turn_index` integer NOT NULL,
	`utterance` text NOT NULL,
	`intent` text,
	`intent_confidence` real,
	`department` text,
	`department_confidence` real,
	`injection` real,
	`frustration` real,
	`outcome` text NOT NULL,
	`action` text,
	`reply` text NOT NULL,
	`jev_ms` integer,
	`total_ms` integer NOT NULL,
	`input_tokens` integer,
	`jev_answers` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turns_conversation_turn` ON `turns` (`conversation_id`,`turn_index`);