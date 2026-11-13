-- Read-only Daily Sales pilot status check.
-- Run against the separate employee_portal_integration database.
-- Replace the values in the WHERE clause as needed.

USE employee_portal_integration;

SELECT
  id AS reportId,
  idempotencyKey,
  employeeId,
  salesDate,
  location,
  store,
  totalAmount,
  status,
  failureMessage,
  createdAt,
  processedAt
FROM daily_sales_inbox
WHERE employeeId = '10105'
   OR idempotencyKey = 'REPLACE_WITH_IDEMPOTENCY_KEY'
ORDER BY createdAt DESC
LIMIT 20;

-- Duplicate check: this should return zero rows.
SELECT idempotencyKey, COUNT(*) AS copies
FROM daily_sales_inbox
GROUP BY idempotencyKey
HAVING COUNT(*) > 1;
