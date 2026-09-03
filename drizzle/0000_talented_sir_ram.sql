CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `gift_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_categories_wedding_slug` ON `gift_categories` (`wedding_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_wedding_order` ON `gift_categories` (`wedding_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text,
	`price_in_cents` integer NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `gift_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_gifts_wedding_slug` ON `gifts` (`wedding_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_gifts_public_list` ON `gifts` (`wedding_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_storage_key_unique` ON `media` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_media_wedding` ON `media` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`client_request_id` text NOT NULL,
	`wedding_id` text NOT NULL,
	`gift_id` text NOT NULL,
	`guest_name` text NOT NULL,
	`guest_email` text NOT NULL,
	`guest_message` text,
	`amount_in_cents` integer NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`settlement_status` text DEFAULT 'PENDING' NOT NULL,
	`provider` text DEFAULT 'ASAAS' NOT NULL,
	`provider_customer_id` text,
	`provider_payment_id` text,
	`provider_checkout_url` text,
	`payment_expires_at` text,
	`confirmed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_public_id_unique` ON `orders` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_client_request_id_unique` ON `orders` (`client_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_provider_payment_id_unique` ON `orders` (`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_wedding_status` ON `orders` (`wedding_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`provider_payment_id` text,
	`payload_hash` text NOT NULL,
	`processing_status` text DEFAULT 'RECEIVED' NOT NULL,
	`last_error` text,
	`received_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_provider_event_id_unique` ON `webhook_events` (`provider_event_id`);--> statement-breakpoint
CREATE INDEX `idx_webhook_provider_payment` ON `webhook_events` (`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `weddings` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`partner_one_name` text NOT NULL,
	`partner_two_name` text NOT NULL,
	`event_at` text NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`headline` text DEFAULT 'Nós vamos nos casar' NOT NULL,
	`welcome_text` text DEFAULT '' NOT NULL,
	`story_title` text DEFAULT 'Foi encontro. Virou casa.' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`venue_name` text DEFAULT '' NOT NULL,
	`venue_address` text DEFAULT '' NOT NULL,
	`venue_instructions` text DEFAULT '' NOT NULL,
	`maps_url` text,
	`hero_image_url` text,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weddings_slug_unique` ON `weddings` (`slug`);