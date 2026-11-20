/**
 * Database migration runner — App Platform PRE_DEPLOY job (see .do/app.yaml, job `migrate`).
 *
 * 1. Applies new drizzle/*.sql migrations (order from drizzle/meta/_journal.json), once each,
 *    recorded in `_schema_migrations`.
 * 2. Re-applies drizzle/grants.sql (additive GRANTs only; safe to repeat).
 *
 * Runs with an admin connection (DATABASE_ADMIN_URL), never the app's least-privilege user.
 * Any failure exits non-zero, which stops the deploy so the old release keeps serving.
 * The old hand-created tables are "baselined": migrations listed in BASELINE are recorded as
 * applied without running when the DB already has their tables.
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

export const MIGRATIONS_TABLE = "_schema_migrations";
const LOCK_NAME = "myteamhub_migrations";

/** Created by hand (scripts/create_daily_sales_database.sql + setup_digitalocean_grants.sql) before this runner existed. */
export const BASELINE: Record<string, string> = {
  "0000_elite_eternals": "users",
  "0001_dashing_jasper_sitwell": "daily_sales_inbox",
};

export type Migration = { tag: string; statements: string[] };

export function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .flatMap((chunk) => splitOnSemicolons(chunk))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Split on `;` outside quotes; drop `--` line comments. Enough for our DDL/GRANT files. */
function splitOnSemicolons(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      cur += "\n";
      continue;
    }
    if (ch === ";") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function loadMigrations(drizzleDir: string): Migration[] {
  const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((e) => ({
      tag: e.tag,
      statements: splitStatements(fs.readFileSync(path.join(drizzleDir, `${e.tag}.sql`), "utf8")),
    }));
}

export type MigrationDb = {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  appliedTags(): Promise<Set<string>>;
  tableExists(name: string): Promise<boolean>;
};

export async function runMigrations(
  db: MigrationDb,
  migrations: Migration[],
  grants: string[],
  log: (msg: string) => void = console.log,
) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      tag VARCHAR(255) NOT NULL PRIMARY KEY,
      appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      baselined BOOLEAN NOT NULL DEFAULT FALSE
    )`,
  );
  const applied = await db.appliedTags();
  const result = { applied: [] as string[], baselined: [] as string[], skipped: [] as string[] };

  for (const m of migrations) {
    if (applied.has(m.tag)) {
      result.skipped.push(m.tag);
      continue;
    }
    const baselineTable = BASELINE[m.tag];
    if (baselineTable && (await db.tableExists(baselineTable))) {
      await db.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (tag, baselined) VALUES (?, TRUE)`, [m.tag]);
      result.baselined.push(m.tag);
      log(`[migrate] baselined ${m.tag} (table ${baselineTable} already exists)`);
      continue;
    }
    log(`[migrate] applying ${m.tag} (${m.statements.length} statement(s))`);
    // MySQL DDL auto-commits, so a failure mid-file can't roll back; we stop and fail the deploy.
    for (const stmt of m.statements) await db.query(stmt);
    await db.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (tag) VALUES (?)`, [m.tag]);
    result.applied.push(m.tag);
  }

  for (const stmt of grants) await db.query(stmt);
  log(`[migrate] grants applied (${grants.length} statement(s))`);
  return result;
}

function connectionConfig(): mysql.ConnectionOptions {
  const raw = process.env.DATABASE_ADMIN_URL;
  if (!raw) throw new Error("DATABASE_ADMIN_URL is not set");
  const url = new URL(raw);
  const rawCa = process.env.DATABASE_CA_CERT?.trim();
  const ca = rawCa && !rawCa.startsWith("-----BEGIN") ? Buffer.from(rawCa, "base64").toString("utf8") : rawCa;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    // The admin URL from the DO panel points at `defaultdb`; we always migrate the app's schema.
    database: process.env.MIGRATION_DATABASE || "employee_portal_integration",
    ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
    multipleStatements: false,
  };
}

async function main() {
  const root = process.cwd();
  const migrations = loadMigrations(path.join(root, "drizzle"));
  const grants = splitStatements(fs.readFileSync(path.join(root, "drizzle", "grants.sql"), "utf8"));
  const conn = await mysql.createConnection(connectionConfig());
  try {
    const [lockRows] = await conn.query("SELECT GET_LOCK(?, 120) AS ok", [LOCK_NAME]);
    if ((lockRows as { ok: number }[])[0]?.ok !== 1) throw new Error("could not acquire migration lock");
    const db: MigrationDb = {
      query: (sql, params) => conn.query(sql, params),
      appliedTags: async () => {
        const [rows] = await conn.query(`SELECT tag FROM \`${MIGRATIONS_TABLE}\``);
        return new Set((rows as { tag: string }[]).map((r) => r.tag));
      },
      tableExists: async (name) => {
        const [rows] = await conn.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
          [name],
        );
        return (rows as unknown[]).length > 0;
      },
    };
    const result = await runMigrations(db, migrations, grants);
    console.log(
      `[migrate] done: applied=[${result.applied.join(", ")}] baselined=[${result.baselined.join(", ")}] already=${result.skipped.length}`,
    );
    await conn.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
  } finally {
    await conn.end();
  }
}

// Run only as the job entrypoint (dist/migrate.js), not when imported by tests.
if (process.argv[1] && /migrate\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    // Message only: never dump the connection config.
    console.error(`[migrate] FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
