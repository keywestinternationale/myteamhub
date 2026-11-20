/**
 * Integration API for the existing Web Portal (server-to-server).
 *
 * The portal-side process calls these endpoints with `Authorization: Bearer <key>`:
 *   GET  /api/integration/v1/daily-sales?status=pending&limit=100
 *   POST /api/integration/v1/daily-sales/:id/status   { status, failureMessage? }
 *   PUT  /api/integration/v1/employees                { employees: [...] }
 *
 * Fail-closed: if INTEGRATION_API_KEYS is not configured, every request gets 503 —
 * these routes are never open. Keys are compared in constant time via SHA-256 digests.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import * as db from "./db";

export const INTEGRATION_BASE_PATH = "/api/integration/v1";

const STATUSES = ["pending", "processing", "processed", "failed"] as const;
type Status = (typeof STATUSES)[number];

/** The DB functions the router needs; injectable so tests run without MySQL. */
export type IntegrationStore = {
  listDailySales(status: Status, limit: number): Promise<db.DailySalesRow[]>;
  getDailySalesById(id: string): Promise<db.DailySalesRow | undefined>;
  updateDailySalesStatus(
    id: string,
    status: Exclude<Status, "pending">,
    failureMessage: string | null,
  ): Promise<void>;
  upsertPortalEmployees(employees: db.PortalEmployeeInput[]): Promise<void>;
};

const defaultStore: IntegrationStore = {
  listDailySales: db.listDailySalesByStatus,
  getDailySalesById: db.getDailySalesById,
  updateDailySalesStatus: db.updateDailySalesStatus,
  upsertPortalEmployees: db.upsertPortalEmployees,
};

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Comma-separated so a key can be rotated without downtime (old + new both valid briefly). */
export function configuredKeyDigests(raw = process.env.INTEGRATION_API_KEYS): Buffer[] {
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 32) // refuse weak keys outright
    .map(digest);
}

export function requireIntegrationKey(getKeys = () => configuredKeyDigests()): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const keys = getKeys();
    if (keys.length === 0) {
      res.status(503).json({ error: "integration_api_not_configured" });
      return;
    }
    const header = req.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="integration"');
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const presented = digest(match[1].trim());
    // Check every key (no early exit) so timing doesn't reveal which slot matched.
    let ok = false;
    for (const key of keys) ok = timingSafeEqual(presented, key) || ok;
    if (!ok) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="integration", error="invalid_token"');
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

const listQuery = z.object({
  status: z.enum(STATUSES).default("pending"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const statusBody = z
  .object({
    status: z.enum(["processing", "processed", "failed"]),
    failureMessage: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.status !== "failed" || !!b.failureMessage, {
    message: "failureMessage is required when status is failed",
    path: ["failureMessage"],
  });

const employeeInput = z.object({
  employeeId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birthdate must use YYYY-MM-DD"),
  active: z.boolean(),
  location: z.string().trim().max(255).nullish(),
  store: z.string().trim().max(255).nullish(),
});

const employeesBody = z.object({
  employees: z
    .array(employeeInput)
    .min(1)
    .max(5000)
    .refine((list) => new Set(list.map((e) => e.employeeId)).size === list.length, {
      message: "employeeId values must be unique",
    }),
});

function toApiReport(row: db.DailySalesRow) {
  let items: unknown = [];
  try {
    items = JSON.parse(row.itemsJson);
  } catch {
    items = [];
  }
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    employeeId: row.employeeId,
    salesDate: row.salesDate,
    location: row.location,
    store: row.store,
    totalAmount: row.totalAmount,
    items,
    status: row.status,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
  };
}

export function createIntegrationRouter(
  store: IntegrationStore = defaultStore,
  getKeys?: () => Buffer[],
): Router {
  const router = Router();
  router.use(requireIntegrationKey(getKeys));

  router.get("/daily-sales", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    try {
      const rows = await store.listDailySales(parsed.data.status, parsed.data.limit);
      res.json({ reports: rows.map(toApiReport) });
    } catch {
      console.error("[integration] list daily sales failed");
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.post("/daily-sales/:id/status", async (req, res) => {
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    const { status } = parsed.data;
    const failureMessage = status === "failed" ? (parsed.data.failureMessage ?? null) : null;
    try {
      const row = await store.getDailySalesById(String(req.params.id));
      if (!row) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      // A processed report is final; repeating the same call is a harmless no-op (safe retries).
      if (row.status === "processed") {
        if (status === "processed") {
          res.json({ id: row.id, status: row.status, unchanged: true });
        } else {
          res.status(409).json({ error: "already_processed" });
        }
        return;
      }
      await store.updateDailySalesStatus(row.id, status, failureMessage);
      res.json({ id: row.id, status, unchanged: false });
    } catch {
      console.error("[integration] update daily sales status failed");
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.put("/employees", async (req, res) => {
    const parsed = employeesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    try {
      await store.upsertPortalEmployees(
        parsed.data.employees.map((e) => ({
          employeeId: e.employeeId,
          name: e.name,
          birthdate: e.birthdate,
          active: e.active,
          location: e.location ?? null,
          store: e.store ?? null,
        })),
      );
      res.json({ upserted: parsed.data.employees.length });
    } catch {
      console.error("[integration] upsert employees failed");
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return router;
}
