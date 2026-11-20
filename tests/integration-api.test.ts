import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  configuredKeyDigests,
  createIntegrationRouter,
  INTEGRATION_BASE_PATH,
  type IntegrationStore,
} from "../server/integration";
import type { DailySalesRow } from "../server/db";

const KEY = "k".repeat(48);
let server: Server | null = null;

afterEach(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

function row(overrides: Partial<DailySalesRow> = {}): DailySalesRow {
  return {
    id: "r1",
    idempotencyKey: "idem-0001",
    employeeId: "10105",
    salesDate: "2026-11-19",
    location: "KIS: HEAD OFFICE",
    store: "STORE A",
    totalAmount: "12500.00",
    itemsJson: '[{"item":"Toy","quantity":2,"totalAmount":500}]',
    status: "pending",
    failureMessage: null,
    createdAt: new Date("2026-11-19T00:00:00Z"),
    processedAt: null,
    ...overrides,
  };
}

function fakeStore(rows: DailySalesRow[] = [row()]) {
  const store = {
    listDailySales: vi.fn(async (status: string) => rows.filter((r) => r.status === status)),
    getDailySalesById: vi.fn(async (id: string) => rows.find((r) => r.id === id)),
    updateDailySalesStatus: vi.fn(async () => {}),
    upsertPortalEmployees: vi.fn(async () => {}),
  } satisfies IntegrationStore;
  return store;
}

async function start(store: IntegrationStore, rawKeys: string = KEY) {
  const app = express();
  app.use(express.json());
  app.use(INTEGRATION_BASE_PATH, createIntegrationRouter(store, () => configuredKeyDigests(rawKeys)));
  server = app.listen(0);
  await new Promise<void>((resolve) => server?.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}${INTEGRATION_BASE_PATH}`;
}

const auth = (key = KEY) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

describe("integration API auth", () => {
  it("is closed (503) when no key is configured, even with a token", async () => {
    const store = fakeStore();
    const base = await start(store, "");
    const res = await fetch(`${base}/daily-sales`, { headers: auth() });
    expect(res.status).toBe(503);
    expect(store.listDailySales).not.toHaveBeenCalled();
  });

  it("ignores keys shorter than 32 chars (treated as unconfigured)", async () => {
    const base = await start(fakeStore(), "short-key");
    const res = await fetch(`${base}/daily-sales`, { headers: auth("short-key") });
    expect(res.status).toBe(503);
  });

  it.each([
    ["no header", {}],
    ["wrong key", auth("x".repeat(48))],
    ["basic scheme", { Authorization: `Basic ${KEY}` }],
  ])("rejects %s with 401", async (_label, headers) => {
    const store = fakeStore();
    const base = await start(store);
    const res = await fetch(`${base}/daily-sales`, { headers });
    expect(res.status).toBe(401);
    expect(store.listDailySales).not.toHaveBeenCalled();
  });

  it("requires auth before revealing unknown routes", async () => {
    const base = await start(fakeStore());
    expect((await fetch(`${base}/nope`)).status).toBe(401);
    expect((await fetch(`${base}/nope`, { headers: auth() })).status).toBe(404);
  });

  it("accepts any of several comma-separated keys (rotation)", async () => {
    const other = "z".repeat(40);
    const base = await start(fakeStore(), `${KEY}, ${other}`);
    expect((await fetch(`${base}/daily-sales`, { headers: auth(other) })).status).toBe(200);
    expect((await fetch(`${base}/daily-sales`, { headers: auth(KEY) })).status).toBe(200);
  });
});

describe("GET /daily-sales", () => {
  it("returns pending reports with parsed items and no-store caching", async () => {
    const store = fakeStore();
    const base = await start(store);
    const res = await fetch(`${base}/daily-sales`, { headers: auth() });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(store.listDailySales).toHaveBeenCalledWith("pending", 100);
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      id: "r1",
      totalAmount: "12500.00",
      items: [{ item: "Toy", quantity: 2, totalAmount: 500 }],
    });
  });

  it("validates status and limit", async () => {
    const base = await start(fakeStore());
    expect((await fetch(`${base}/daily-sales?status=bogus`, { headers: auth() })).status).toBe(400);
    expect((await fetch(`${base}/daily-sales?limit=9999`, { headers: auth() })).status).toBe(400);
  });
});

describe("POST /daily-sales/:id/status", () => {
  const post = (base: string, id: string, body: unknown) =>
    fetch(`${base}/daily-sales/${id}/status`, { method: "POST", headers: auth(), body: JSON.stringify(body) });

  it("moves a report to processed", async () => {
    const store = fakeStore();
    const base = await start(store);
    const res = await post(base, "r1", { status: "processed" });
    expect(res.status).toBe(200);
    expect(store.updateDailySalesStatus).toHaveBeenCalledWith("r1", "processed", null);
  });

  it("requires a failureMessage for failed", async () => {
    const store = fakeStore();
    const base = await start(store);
    expect((await post(base, "r1", { status: "failed" })).status).toBe(400);
    expect((await post(base, "r1", { status: "failed", failureMessage: "bad store" })).status).toBe(200);
    expect(store.updateDailySalesStatus).toHaveBeenCalledWith("r1", "failed", "bad store");
  });

  it("refuses to set status back to pending", async () => {
    const base = await start(fakeStore());
    expect((await post(base, "r1", { status: "pending" })).status).toBe(400);
  });

  it("404s an unknown report", async () => {
    const base = await start(fakeStore());
    expect((await post(base, "missing", { status: "processed" })).status).toBe(404);
  });

  it("treats processed as final but lets a repeat succeed as a no-op", async () => {
    const store = fakeStore([row({ status: "processed" })]);
    const base = await start(store);
    const again = await post(base, "r1", { status: "processed" });
    expect(again.status).toBe(200);
    expect((await again.json()).unchanged).toBe(true);
    expect((await post(base, "r1", { status: "failed", failureMessage: "x" })).status).toBe(409);
    expect(store.updateDailySalesStatus).not.toHaveBeenCalled();
  });
});

describe("PUT /employees", () => {
  const put = (base: string, body: unknown) =>
    fetch(`${base}/employees`, { method: "PUT", headers: auth(), body: JSON.stringify(body) });
  const emp = { employeeId: "10105", name: "Juan Dela Cruz", birthdate: "1990-01-31", active: true };

  it("upserts employees with optional fields normalised to null", async () => {
    const store = fakeStore();
    const base = await start(store);
    const res = await put(base, { employees: [emp, { ...emp, employeeId: "10106", store: "STORE A" }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ upserted: 2 });
    expect(store.upsertPortalEmployees).toHaveBeenCalledWith([
      { ...emp, location: null, store: null },
      { ...emp, employeeId: "10106", location: null, store: "STORE A" },
    ]);
  });

  it("rejects bad dates, duplicates and empty lists", async () => {
    const base = await start(fakeStore());
    expect((await put(base, { employees: [{ ...emp, birthdate: "31/01/1990" }] })).status).toBe(400);
    expect((await put(base, { employees: [emp, emp] })).status).toBe(400);
    expect((await put(base, { employees: [] })).status).toBe(400);
  });
});
