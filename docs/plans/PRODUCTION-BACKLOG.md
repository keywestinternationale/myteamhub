# Production backlog

Work deliberately deferred out of the active [ROADMAP](ROADMAP.md) — low visible ROI, large+invisible refactors,
blocked items, or out-of-scope. Each entry says **why** it's deferred and **what unblocks it**, so the decision is
auditable and revisitable. Don't let this become a dump — re-evaluate periodically.

## <Item title>
*(deferred YYYY-MM-DD — reason / who decided)*

**What:** <the work>
**Why deferred:** <low ROI / mostly-invisible / blocked by X / out of scope>
**Unblocks when:** <condition>

## Integration API: rate limiting and office-IP allowlist
*(deferred 2026-11-20 — shipped bearer-key auth first)*

**What:** Throttle `/api/integration/v1/*` per IP and optionally allow only the portal office's static IP (needs `trust proxy` set correctly behind App Platform).
**Why deferred:** Key auth (≥32-char random key, constant-time compare, fail-closed) already blocks unauthenticated use; the office IP is unknown yet.
**Unblocks when:** Debbie confirms the office's static public IP.

## Mobile login against `portal_employees`; close public `dailySales.submit`
*(deferred 2026-11-20 — needs the portal's employee list first)*

**What:** Employee ID + birthdate login backed by `portal_employees` (active only), then make `dailySales.submit` a protected procedure that takes `employeeId` from the session, not the request body (quote item 1).
**Why deferred:** The table and push endpoint now exist, but they're empty until the portal sends employees; switching login before that would lock everyone out.
**Unblocks when:** The portal has pushed a real employee list via `PUT /api/integration/v1/employees`.
