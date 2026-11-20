import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { configuredKeyDigests } from "../server/integration";
import { buildOpenApiSpec, createIntegrationDocsRouter, INTEGRATION_DOCS_PATH } from "../server/integration-docs";

const KEY = "k".repeat(48);
let server: Server | null = null;

afterEach(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

async function start(rawKeys = KEY) {
  const app = express();
  app.use(INTEGRATION_DOCS_PATH, createIntegrationDocsRouter(() => configuredKeyDigests(rawKeys)));
  server = app.listen(0);
  await new Promise<void>((resolve) => server?.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}${INTEGRATION_DOCS_PATH}`;
}

const basic = (user: string, pass: string) => ({
  Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
});

describe("integration docs auth", () => {
  it("is closed (503) when no key is configured", async () => {
    const base = await start("");
    expect((await fetch(`${base}/`, { headers: basic("x", KEY) })).status).toBe(503);
  });

  it.each([
    ["no credentials", {}],
    ["wrong password", basic("debbie", "x".repeat(48))],
    ["bearer instead of basic", { Authorization: `Bearer ${KEY}` }],
  ])("challenges %s with 401 + WWW-Authenticate", async (_label, headers) => {
    const base = await start();
    for (const p of ["/", "/openapi.json", "/assets/swagger-ui-bundle.js"]) {
      const res = await fetch(`${base}${p}`, { headers });
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toMatch(/^Basic /);
    }
  });

  it("serves page, spec and self-hosted assets with any username + the key", async () => {
    const base = await start();
    const h = basic("anyone", KEY);
    const page = await fetch(`${base}/`, { headers: h });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(await page.text()).toContain("assets/swagger-ui-bundle.js");

    const spec = await fetch(`${base}/openapi.json`, { headers: h });
    expect(spec.status).toBe(200);
    expect((await spec.json()).components.securitySchemes.bearerAuth.scheme).toBe("bearer");

    const js = await fetch(`${base}/assets/swagger-ui-bundle.js`, { headers: h });
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("javascript");
  });

  it("redirects the bare path to the trailing slash", async () => {
    const base = await start();
    const res = await fetch(base, { headers: basic("a", KEY), redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${INTEGRATION_DOCS_PATH}/`);
  });

  it("does not expose other files from swagger-ui-dist", async () => {
    const base = await start();
    const res = await fetch(`${base}/assets/package.json`, { headers: basic("a", KEY) });
    expect(res.status).toBe(404);
  });
});

describe("OpenAPI spec", () => {
  it("documents every route with bearer auth required globally", () => {
    const spec = buildOpenApiSpec();
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(spec.paths).sort()).toEqual(["/daily-sales", "/daily-sales/{id}/status", "/employees"]);
  });

  it("derives request bodies from the live zod schemas", () => {
    const spec = buildOpenApiSpec();
    const status = spec.paths["/daily-sales/{id}/status"].post.requestBody.content["application/json"].schema as {
      properties: { status: { enum: string[] } };
    };
    expect(status.properties.status.enum).toEqual(["processing", "processed", "failed"]);
    const employees = spec.paths["/employees"].put.requestBody.content["application/json"].schema as {
      properties: { employees: { maxItems: number } };
    };
    expect(employees.properties.employees.maxItems).toBe(5000);
  });
});
