import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import servicesApp from "./services.index";
import { createServiceSchema, listServicesQuery } from "./services.schema";
import { ServicesService } from "./services.service";
import type { AppEnv } from "../../types";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache } from "../../middlewares/rbac";

function mountServicesApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/services", servicesApp);
  return app;
}

describe("services.schema", () => {
  it("createServiceSchema requires name and category", () => {
    expect(createServiceSchema.safeParse({ basePrice: 1, durationMinutes: 30 }).success).toBe(
      false
    );
    expect(
      createServiceSchema.safeParse({
        name: "Cut",
        category: "Hair",
        basePrice: 50,
        durationMinutes: 30,
      }).success
    ).toBe(true);
  });

  it("listServicesQuery defaults page and limit", () => {
    const q = listServicesQuery.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
});

describe("ServicesService", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getById returns null when service missing", async () => {
    vi.mocked(db.service.findUnique).mockResolvedValue(null);
    expect(await ServicesService.getById(db, "missing")).toBeNull();
  });
});

describe("services HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    invalidatePermissionCache("role-sv");
    vi.clearAllMocks();
  });

  it("GET /services returns 200", async () => {
    vi.mocked(db.service.count).mockResolvedValue(0);
    vi.mocked(db.service.findMany).mockResolvedValue([]);
    const app = mountServicesApp(db);
    const res = await app.request("http://test/services");
    expect(res.status).toBe(200);
  });

  it("GET /services/:id returns 404 when missing", async () => {
    vi.mocked(db.service.findUnique).mockResolvedValue(null);
    const app = mountServicesApp(db);
    const res = await app.request("http://test/services/missing-id");
    expect(res.status).toBe(404);
  });

  it("POST /services returns 401 without token", async () => {
    const app = mountServicesApp(db);
    const res = await app.request("http://test/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cut",
        category: "Hair",
        basePrice: 50,
        durationMinutes: 30,
      }),
    });
    expect(res.status).toBe(401);
  });
});
