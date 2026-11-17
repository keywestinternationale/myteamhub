-- Run AFTER create_daily_sales_database.sql, as doadmin, on the DigitalOcean cluster.
-- Prerequisite: users `myteamhub_api` and `portal_worker` were created in the DigitalOcean
-- control panel (Users & Databases tab), so their passwords never appear in this file.

USE employee_portal_integration;

-- Auth table used by the API (same definition as drizzle/0000_elite_eternals.sql).
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT NOT NULL,
  openId VARCHAR(64) NOT NULL,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  updatedAt TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT users_id PRIMARY KEY (id),
  CONSTRAINT users_openId_unique UNIQUE (openId)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Control-panel users start with broad privileges; reduce them to least privilege.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'myteamhub_api'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'portal_worker'@'%';

-- API: submit Daily Sales (insert + idempotency lookup) and manage login users.
GRANT SELECT, INSERT ON employee_portal_integration.daily_sales_inbox TO 'myteamhub_api'@'%';
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.users TO 'myteamhub_api'@'%';

-- Portal worker: read pending rows and move them through pending -> processing -> processed/failed.
GRANT SELECT, UPDATE ON employee_portal_integration.daily_sales_inbox TO 'portal_worker'@'%';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'myteamhub_api'@'%';
SHOW GRANTS FOR 'portal_worker'@'%';
