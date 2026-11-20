import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  dailySalesInbox,
  DailySalesInbox,
  InsertDailySalesInbox,
  InsertUser,
  portalEmployees,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // DigitalOcean Managed MySQL requires TLS with its own CA; DATABASE_CA_CERT holds that PEM.
      // Accept either a raw PEM or a base64-encoded PEM (how the deploy pipeline passes it).
      const rawCa = process.env.DATABASE_CA_CERT?.trim();
      const ca =
        rawCa && !rawCa.startsWith("-----BEGIN")
          ? Buffer.from(rawCa, "base64").toString("utf8")
          : rawCa;
      _db = ca
        ? drizzle({ connection: { uri: process.env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true } } })
        : drizzle(process.env.DATABASE_URL);
    } catch {
      console.warn("[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getDailySalesByIdempotencyKey(idempotencyKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(dailySalesInbox)
    .where(eq(dailySalesInbox.idempotencyKey, idempotencyKey))
    .limit(1);
  return result[0];
}

export async function insertDailySalesInbox(report: InsertDailySalesInbox) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(dailySalesInbox).values(report);
  return report;
}

// ---- Integration API (server/integration.ts) ----

export type DailySalesRow = DailySalesInbox;
export type PortalEmployeeInput = {
  employeeId: string;
  name: string;
  birthdate: string;
  active: boolean;
  location: string | null;
  store: string | null;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function listDailySalesByStatus(
  status: DailySalesInbox["status"],
  limit: number,
): Promise<DailySalesRow[]> {
  const db = await requireDb();
  return db
    .select()
    .from(dailySalesInbox)
    .where(eq(dailySalesInbox.status, status))
    .orderBy(asc(dailySalesInbox.createdAt), asc(dailySalesInbox.id))
    .limit(limit);
}

export async function getDailySalesById(id: string): Promise<DailySalesRow | undefined> {
  const db = await requireDb();
  const result = await db.select().from(dailySalesInbox).where(eq(dailySalesInbox.id, id)).limit(1);
  return result[0];
}

export async function updateDailySalesStatus(
  id: string,
  status: "processing" | "processed" | "failed",
  failureMessage: string | null,
): Promise<void> {
  const db = await requireDb();
  await db
    .update(dailySalesInbox)
    .set({
      status,
      failureMessage,
      processedAt: status === "processed" ? new Date() : null,
    })
    .where(eq(dailySalesInbox.id, id));
}

export async function upsertPortalEmployees(employees: PortalEmployeeInput[]): Promise<void> {
  const db = await requireDb();
  // Chunk so one huge payload doesn't become one oversized statement.
  for (let i = 0; i < employees.length; i += 500) {
    await db
      .insert(portalEmployees)
      .values(employees.slice(i, i + 500))
      .onDuplicateKeyUpdate({
        set: {
          name: sql`values(${portalEmployees.name})`,
          birthdate: sql`values(${portalEmployees.birthdate})`,
          active: sql`values(${portalEmployees.active})`,
          location: sql`values(${portalEmployees.location})`,
          store: sql`values(${portalEmployees.store})`,
        },
      });
  }
}
