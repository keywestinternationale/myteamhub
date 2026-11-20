import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { loadMigrations, runMigrations, splitStatements, type MigrationDb } from "../server/migrate";

const drizzleDir = path.resolve(__dirname, "../drizzle");

function fakeDb(existingTables: string[], appliedTags: string[] = []) {
  const queries: string[] = [];
  const applied = new Set(appliedTags);
  const db: MigrationDb = {
    query: async (sql, params) => {
      queries.push(sql);
      if (sql.startsWith("INSERT INTO `_schema_migrations`")) applied.add(String(params?.[0]));
      return [];
    },
    appliedTags: async () => new Set(applied),
    tableExists: async (name) => existingTables.includes(name),
  };
  return { db, queries, applied };
}

describe("splitStatements", () => {
  it("splits drizzle breakpoints and semicolons, drops comments, keeps quoted ;", () => {
    expect(
      splitStatements("-- c1\nGRANT A ON t TO 'u;x'@'%';\n-- c2\nCREATE TABLE x (a int);--> statement-breakpoint\nSELECT 1"),
    ).toEqual(["GRANT A ON t TO 'u;x'@'%'", "CREATE TABLE x (a int)", "SELECT 1"]);
  });
});

describe("repo migrations", () => {
  it("loads every journal entry in order, each with SQL", () => {
    const ms = loadMigrations(drizzleDir);
    expect(ms.map((m) => m.tag.slice(0, 4))).toEqual(ms.map((_, i) => String(i).padStart(4, "0")));
    for (const m of ms) expect(m.statements.length).toBeGreaterThan(0);
  });

  it("grants.sql is additive only (no REVOKE / DROP)", () => {
    const grants = splitStatements(fs.readFileSync(path.join(drizzleDir, "grants.sql"), "utf8"));
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g).toMatch(/^GRANT /);
  });
});

describe("runMigrations", () => {
  const ms = [
    { tag: "0000_elite_eternals", statements: ["CREATE TABLE users (id int)"] },
    { tag: "0001_dashing_jasper_sitwell", statements: ["CREATE TABLE daily_sales_inbox (id int)"] },
    { tag: "0002_new", statements: ["CREATE TABLE portal_employees (id int)"] },
  ];

  it("on the existing prod DB: baselines hand-made tables, applies only new ones, then grants", async () => {
    const { db, queries } = fakeDb(["users", "daily_sales_inbox"]);
    const r = await runMigrations(db, ms, ["GRANT X"], () => {});
    expect(r).toEqual({ applied: ["0002_new"], baselined: ["0000_elite_eternals", "0001_dashing_jasper_sitwell"], skipped: [] });
    expect(queries).not.toContain("CREATE TABLE users (id int)");
    expect(queries).toContain("CREATE TABLE portal_employees (id int)");
    expect(queries.at(-1)).toBe("GRANT X");
  });

  it("on a fresh DB: runs everything", async () => {
    const { db } = fakeDb([]);
    const r = await runMigrations(db, ms, [], () => {});
    expect(r.applied).toEqual(ms.map((m) => m.tag));
  });

  it("second run is a no-op except grants", async () => {
    const { db, queries } = fakeDb([], ms.map((m) => m.tag));
    const r = await runMigrations(db, ms, ["GRANT X"], () => {});
    expect(r.applied).toEqual([]);
    expect(queries.filter((q) => q.startsWith("CREATE TABLE ") && !q.includes("_schema_migrations"))).toEqual([]);
  });

  it("a failing statement stops the run and does not record the migration", async () => {
    const { db, applied } = fakeDb(["users", "daily_sales_inbox"]);
    const failing: MigrationDb = {
      ...db,
      query: async (sql, params) => {
        if (sql.includes("portal_employees")) throw new Error("boom");
        return db.query(sql, params);
      },
    };
    await expect(runMigrations(failing, ms, ["GRANT X"], () => {})).rejects.toThrow("boom");
    expect(applied.has("0002_new")).toBe(false);
  });
});
