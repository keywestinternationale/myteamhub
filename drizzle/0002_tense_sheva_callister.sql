CREATE TABLE `portal_employees` (
	`employeeId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`birthdate` varchar(10) NOT NULL,
	`active` boolean NOT NULL,
	`location` varchar(255),
	`store` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_employees_employeeId` PRIMARY KEY(`employeeId`)
);
