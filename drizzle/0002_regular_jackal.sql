CREATE TABLE `admin_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`order_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_notifications_dedupe_key_unique` ON `admin_notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_notifications_wedding_created` ON `admin_notifications` (`wedding_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_wedding_read` ON `admin_notifications` (`wedding_id`,`read_at`);--> statement-breakpoint
ALTER TABLE `weddings` ADD `pix_key` text DEFAULT 'casamentoHevilaCarlos@gmail.com' NOT NULL;--> statement-breakpoint
ALTER TABLE `weddings` ADD `pix_recipient_name` text DEFAULT 'HEVILA E CARLOS' NOT NULL;--> statement-breakpoint
ALTER TABLE `weddings` ADD `pix_recipient_city` text DEFAULT 'SAO PAULO' NOT NULL;