-- Least-privilege grants, re-applied by server/migrate.ts on every deploy (after migrations).
-- ADDITIVE ONLY: never REVOKE here — the running release keeps using these users mid-deploy.
-- Users are created once in the DO control panel (see scripts/setup_digitalocean_grants.sql).

-- API: submit Daily Sales, move reports through statuses for the portal, manage login users,
-- upsert the employee list the portal pushes.
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.daily_sales_inbox TO 'myteamhub_api'@'%';
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.users TO 'myteamhub_api'@'%';
GRANT SELECT, INSERT, UPDATE ON employee_portal_integration.portal_employees TO 'myteamhub_api'@'%';

-- Portal worker (direct-DB fallback): read pending rows and update their status.
GRANT SELECT, UPDATE ON employee_portal_integration.daily_sales_inbox TO 'portal_worker'@'%';
