# Employee Portal Mobile pilot runbook

## Pilot status

The portal-side worker has been reported as deployed and has successfully processed an amount-only Daily Sales submission without creating a duplicate.

The mobile app is still in prototype sign-in mode. Before sharing with staff, the developer must replace the prototype sign-in with the approved pilot authentication or add a server-enforced pilot allowlist. Do not distribute the `Fill test access` flow to staff.

## Pilot scope

- Participants: 2–3 named staff members
- Workflow: sign in, view dashboard, submit Daily Sales, confirm status
- Submission modes: amount-only first; itemized Daily Sales after the first successful pass
- Data: use real low-risk pilot reports or clearly marked test reports approved by the portal owner
- Portal database: remains private; the mobile app only calls the approved API/integration layer
- Pilot window: developer must provide start date, end date, and support contact

## Staff instructions after authentication is ready

1. Open the approved pilot link or install the approved iOS/Android pilot build.
2. Sign in with the individual credentials provided privately by the administrator.
3. Confirm the dashboard shows the correct employee identity.
4. Tap **Record today’s sales**.
5. Select the sales date, location, and store.
6. For an amount-only report, enter **Daily total amount** and leave item details empty.
7. For a detailed report, add item rows with item, quantity, and amount.
8. Tap **Save Daily Sales**.
9. Keep the confirmation/report ID or screenshot until the status is confirmed.
10. Report any incorrect employee identity, store, amount, duplicate, or failed submission to the pilot support contact.

## Interim status check for the developer

Until a staff-facing status screen is approved, the developer can run the read-only query in `scripts/check_daily_sales_status.sql` against the separate integration database. Search by `reportId`, `idempotencyKey`, employee ID, or creation time.

Expected status transitions:

```text
pending → processing → processed
                         ↘ failed
```

A report must not be inserted twice when the same idempotency key is retried.

## Pilot acceptance evidence

For each staff member, retain:

- staff identifier and pilot date
- report ID or idempotency key
- amount-only result
- itemized result, when tested
- status transition to `processed` or documented `failed` result
- confirmation that exactly one portal Daily Sales record was created

Do not retain passwords in this document. Do not put portal database credentials in the mobile app.

## Information still needed from the developer

1. What exact HTTPS API base URL will the pilot app use?
2. Does that API write to the same `daily_sales_inbox` database read by the deployed worker?
3. What authentication method protects the pilot (portal SSO, per-staff accounts, invite codes, or another approved method)?
4. How will staff check status: app screen, report ID lookup, or developer-only database query?
5. What is the pilot start/end date and support contact?
6. Should the pilot use a web link, Expo Go, TestFlight, Android APK, or another distribution method?
7. Which 2–3 staff IDs are approved, and which stores/locations should each see?
