# Daily Sales integration handoff

## Simple architecture

```text
Mobile app → project API → daily_sales_inbox table → portal-side worker → existing portal
```

The mobile app and this API do **not** connect to or expose the existing portal database. The portal-side worker is responsible for reading pending rows from the separate integration database and processing them in the existing portal.

## Create the separate MySQL database

The ready-to-run files are:

- `scripts/create_daily_sales_database.sql`
- `scripts/create_daily_sales_database.sh`
- `scripts/create_daily_sales_database.ps1` for Windows PowerShell
- `scripts/create_daily_sales_database.bat` for Windows Command Prompt
- `scripts/create_daily_sales_database.cmd` as an equivalent Windows Command Prompt launcher

Run the shell wrapper on the backend/server machine, not from the mobile app:

```bash
export MYSQL_HOST="your-mysql-host"
export MYSQL_USER="your-setup-user"
export MYSQL_PASSWORD="your-password" # or omit and enter it at the prompt
./scripts/create_daily_sales_database.sh
```

The script creates the separate `employee_portal_integration` database and `daily_sales_inbox` table. Never put the password in the mobile bundle, source control, or chat. The backend should use a restricted database account after setup.

### Windows PowerShell

Install the MySQL client so `mysql.exe` is available on PATH, then run:

```powershell
$env:MYSQL_HOST = "your-mysql-host"
$env:MYSQL_USER = "your-setup-user"
$env:MYSQL_PASSWORD = "your-password" # or omit and enter it at the prompt
.\scripts\create_daily_sales_database.ps1
```

Alternatively, from Command Prompt after setting the same environment variables, run:

```bat
scripts\\create_daily_sales_database.bat
```

If Windows does not recognize the `.bat` download, use the equivalent `.cmd` file:

```bat
scripts\\create_daily_sales_database.cmd
```

## Mobile API

The app calls the typed tRPC mutation:

```text
 dailySales.submit
```

The HTTP service is the project API under `/api/trpc`. The request fields are:

```json
{
  "idempotencyKey": "daily-unique-request-key",
  "employeeId": "10105",
  "salesDate": "2026-10-25",
  "location": "KIS: HEAD OFFICE",
  "store": "TOY KINGDOM: TOY EXPRESS - 0006 SM NORTH EDSA",
  "totalAmount": 12500.00,
  "items": []
}
```

`items` is optional in the user experience and is sent as an empty array for amount-only reports. When details are entered, each item contains `item`, `quantity`, and `totalAmount`.

A successful response is:

```json
{
  "reportId": "uuid",
  "status": "pending",
  "duplicate": false
}
```

Submitting the same `idempotencyKey` again returns the original `reportId` and does not create a duplicate row.

## Integration table

Table: `daily_sales_inbox`

Important columns:

- `id`: generated report UUID
- `idempotencyKey`: unique retry-protection key
- `employeeId`
- `salesDate` in `YYYY-MM-DD` format
- `location`
- `store`
- `totalAmount` as decimal(12,2)
- `itemsJson`: JSON array; `[]` for amount-only reports
- `status`: `pending`, `processing`, `processed`, or `failed`
- `failureMessage`: optional processing error
- `createdAt`
- `processedAt`

## Portal worker behavior

1. Read rows where `status = 'pending'`.
2. Change the row to `processing` before handling it.
3. Process the report through the existing portal workflow.
4. Set `status = 'processed'` and `processedAt` after success.
5. Set `status = 'failed'` and write `failureMessage` if processing fails.
6. Use `id` or `idempotencyKey` so retries never create duplicate portal reports.

## Important staging note

The current prototype uses the project API endpoint without portal credentials because its sign-in screen is still prototype-only. Keep this as an internal staging/pilot endpoint. Before production release, add the app's real authentication or another approved request-authentication method at the API boundary. No portal database credentials belong in the mobile app.
