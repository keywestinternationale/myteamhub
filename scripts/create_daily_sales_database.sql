-- Daily Sales integration database
-- Run this script on the separate MySQL server used by the mobile-app backend.
-- Do not put database passwords in this file or in the mobile app.

CREATE DATABASE IF NOT EXISTS employee_portal_integration
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE employee_portal_integration;

CREATE TABLE IF NOT EXISTS daily_sales_inbox (
  id VARCHAR(36) NOT NULL,
  idempotencyKey VARCHAR(80) NOT NULL,
  employeeId VARCHAR(64) NOT NULL,
  salesDate VARCHAR(10) NOT NULL,
  location VARCHAR(255) NOT NULL,
  store VARCHAR(255) NOT NULL,
  totalAmount DECIMAL(12, 2) NOT NULL,
  itemsJson TEXT NOT NULL,
  status ENUM('pending', 'processing', 'processed', 'failed') NOT NULL DEFAULT 'pending',
  failureMessage TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_sales_idempotency (idempotencyKey),
  KEY idx_daily_sales_status_created (status, createdAt),
  KEY idx_daily_sales_employee_date (employeeId, salesDate)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Optional verification:
-- SELECT COUNT(*) AS daily_sales_rows FROM daily_sales_inbox;
-- SELECT id, employeeId, salesDate, totalAmount, status, createdAt
-- FROM daily_sales_inbox
-- ORDER BY createdAt DESC
-- LIMIT 10;
