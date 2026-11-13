import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Separate integration inbox for Daily Sales.
 * The existing portal database is not accessed by this app. A portal-side
 * worker can read pending rows from this table and process them separately.
 */
export const dailySalesInbox = mysqlTable("daily_sales_inbox", {
  id: varchar("id", { length: 36 }).primaryKey(),
  idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull().unique(),
  employeeId: varchar("employeeId", { length: 64 }).notNull(),
  salesDate: varchar("salesDate", { length: 10 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  store: varchar("store", { length: 255 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  itemsJson: text("itemsJson").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "processed", "failed"]).default("pending").notNull(),
  failureMessage: text("failureMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type DailySalesInbox = typeof dailySalesInbox.$inferSelect;
export type InsertDailySalesInbox = typeof dailySalesInbox.$inferInsert;
