-- Integration API for the Web Portal (server/integration.ts). Run ONCE as doadmin on the
-- DigitalOcean cluster (Databases → myteamhub-db → Console, or any MySQL client with TLS).
-- Additive only: creates one table and widens the API user's grants. Safe to re-run.

USE employee_portal_integration;

-- Employee master list pushed by the portal (same definition as drizzle/0002_tense_sheva_callister.sql).
CREATE TABLE IF NOT EXISTS portal_employees (
  employeeId VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  birthdate VARCHAR(10) NOT NULL,
  active BOOLEAN NOT NULL,
  location VARCHAR(255),
  store VARCHAR(255),
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  updatedAt TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT portal_employees_employeeId PRIMARY KEY (employeeId)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The API now moves reports through pending -> processing -> processed/failed for the portal.
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.daily_sales_inbox TO 'myteamhub_api'@'%';
-- The API upserts the employee list the portal pushes.
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.portal_employees TO 'myteamhub_api'@'%';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'myteamhub_api'@'%';
