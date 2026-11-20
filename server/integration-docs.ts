/**
 * Swagger / OpenAPI docs for the Web Portal integration API, served at /api/integration/docs.
 *
 * The docs page itself is protected: HTTP Basic auth where the password is an integration API
 * key (username is ignored). Same fail-closed rule as the API — no key configured => 503.
 * Inside the page, "Authorize" takes the same key as a Bearer token for "Try it out".
 * Swagger UI assets are self-hosted from swagger-ui-dist (no third-party CDN).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  configuredKeyDigests,
  employeesBody,
  INTEGRATION_BASE_PATH,
  statusBody,
} from "./integration";

export const INTEGRATION_DOCS_PATH = "/api/integration/docs";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

export function requireDocsBasicAuth(getKeys = () => configuredKeyDigests()): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const keys = getKeys();
    if (keys.length === 0) {
      res.status(503).json({ error: "integration_api_not_configured" });
      return;
    }
    const match = /^Basic\s+(.+)$/i.exec(req.get("authorization") ?? "");
    let password = "";
    if (match) {
      const decoded = Buffer.from(match[1].trim(), "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      password = colon >= 0 ? decoded.slice(colon + 1) : "";
    }
    const presented = digest(password);
    let ok = false;
    for (const key of keys) ok = timingSafeEqual(presented, key) || ok;
    if (!match || !ok) {
      res.setHeader("WWW-Authenticate", 'Basic realm="myteamhub integration docs", charset="UTF-8"');
      res.status(401).send("Authentication required. Use any username and the integration API key as the password.");
      return;
    }
    next();
  };
}

const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input", target: "openapi-3.0" }) as Record<string, unknown>;
  return rest;
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const commonErrors = {
  "401": errorResponse("Missing or invalid API key."),
  "503": errorResponse("Integration API not configured on the server (no key set)."),
  "500": errorResponse("Internal error."),
};

export function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "myteamhub Web Portal Integration API",
      version: "1.0.0",
      description:
        "Server-to-server API for the existing Web Portal: pull Daily Sales reports, report back processing status, and push the employee master list.\n\n" +
        "**Auth:** every request needs `Authorization: Bearer <INTEGRATION_API_KEY>`. Click **Authorize** and paste the key to use *Try it out*. " +
        "Requests made here hit the live API and change real data.",
    },
    servers: [{ url: INTEGRATION_BASE_PATH, description: "This server" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Daily Sales", description: "Reports submitted from the mobile app" },
      { name: "Employees", description: "Employee master list from the Web Portal" },
    ],
    paths: {
      "/daily-sales": {
        get: {
          tags: ["Daily Sales"],
          summary: "List Daily Sales reports by status (oldest first)",
          operationId: "listDailySales",
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["pending", "processing", "processed", "failed"], default: "pending" },
            },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          ],
          responses: {
            "200": {
              description: "Reports",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { reports: { type: "array", items: { $ref: "#/components/schemas/DailySalesReport" } } },
                    required: ["reports"],
                  },
                },
              },
            },
            "400": errorResponse("Invalid status or limit."),
            ...commonErrors,
          },
        },
      },
      "/daily-sales/{id}/status": {
        post: {
          tags: ["Daily Sales"],
          summary: "Update a report's processing status",
          description:
            "`processed` is final: repeating it returns 200 with `unchanged: true`; changing it afterwards returns 409. `failed` requires `failureMessage`.",
          operationId: "updateDailySalesStatus",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Report id (UUID)" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: jsonSchema(statusBody),
                examples: {
                  processed: { value: { status: "processed" } },
                  failed: { value: { status: "failed", failureMessage: "Unknown store code" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Status updated (or already processed)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" }, status: { type: "string" }, unchanged: { type: "boolean" } },
                    required: ["id", "status", "unchanged"],
                  },
                },
              },
            },
            "400": errorResponse("Invalid body."),
            "404": errorResponse("No report with that id."),
            "409": errorResponse("Report is already processed."),
            ...commonErrors,
          },
        },
      },
      "/employees": {
        put: {
          tags: ["Employees"],
          summary: "Upsert the employee master list",
          description:
            "Upserts by `employeeId` (1–5000 per call, unique within a call). Send resigned staff with `active: false`; omitted employees are left unchanged.",
          operationId: "upsertEmployees",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: jsonSchema(employeesBody),
                example: {
                  employees: [
                    {
                      employeeId: "10105",
                      name: "Juan Dela Cruz",
                      birthdate: "1990-01-31",
                      active: true,
                      location: "KIS: HEAD OFFICE",
                      store: null,
                    },
                  ],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Upserted",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { upserted: { type: "integer" } }, required: ["upserted"] },
                },
              },
            },
            "400": errorResponse("Invalid body (bad date, duplicate ids, empty list...)."),
            ...commonErrors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Integration API key" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" }, issues: { type: "array", items: { type: "object" } } },
          required: ["error"],
        },
        DailySalesReport: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            idempotencyKey: { type: "string" },
            employeeId: { type: "string" },
            salesDate: { type: "string", example: "2026-11-19", description: "YYYY-MM-DD" },
            location: { type: "string" },
            store: { type: "string" },
            totalAmount: { type: "string", example: "12500.00", description: "Decimal as a string" },
            items: {
              type: "array",
              description: "Empty for amount-only reports",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  quantity: { type: "number" },
                  totalAmount: { type: "number" },
                },
              },
            },
            status: { type: "string", enum: ["pending", "processing", "processed", "failed"] },
            failureMessage: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            processedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
      },
    },
  };
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>myteamhub Integration API</title>
  <link rel="stylesheet" href="assets/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="assets/swagger-ui-bundle.js"></script>
  <script src="init.js"></script>
</body>
</html>`;

// External file (not inline) so the CSP can forbid inline scripts.
const INIT_JS = `window.ui = SwaggerUIBundle({
  url: "openapi.json",
  dom_id: "#swagger-ui",
  deepLinking: true,
  persistAuthorization: false,
  tryItOutEnabled: false,
});`;

function swaggerAssetsDir() {
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve("swagger-ui-dist/package.json"));
}

export function createIntegrationDocsRouter(getKeys?: () => Buffer[]): Router {
  const router = Router();
  router.use(requireDocsBasicAuth(getKeys));
  router.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // Relative asset URLs need the trailing slash.
  router.get("/", (req, res) => {
    if (!req.originalUrl.split("?")[0].endsWith("/")) {
      res.redirect(301, `${INTEGRATION_DOCS_PATH}/`);
      return;
    }
    res.type("html").send(INDEX_HTML);
  });
  router.get("/init.js", (_req, res) => res.type("application/javascript").send(INIT_JS));
  router.get("/openapi.json", (_req, res) => res.json(buildOpenApiSpec()));

  const allowedAssets = new Set(["swagger-ui.css", "swagger-ui-bundle.js", "favicon-32x32.png", "favicon-16x16.png"]);
  const assets = express.static(swaggerAssetsDir(), { index: false, fallthrough: false });
  router.use("/assets", (req, res, next) => {
    if (!allowedAssets.has(req.path.replace(/^\//, ""))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    assets(req, res, next);
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
  return router;
}
