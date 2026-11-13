CREATE TABLE `daily_sales_inbox` (
	`id` varchar(36) NOT NULL,
	`idempotencyKey` varchar(80) NOT NULL,
	`employeeId` varchar(64) NOT NULL,
	`salesDate` varchar(10) NOT NULL,
	`location` varchar(255) NOT NULL,
	`store` varchar(255) NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`itemsJson` text NOT NULL,
	`status` enum('pending','processing','processed','failed') NOT NULL DEFAULT 'pending',
	`failureMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `daily_sales_inbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_sales_inbox_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
