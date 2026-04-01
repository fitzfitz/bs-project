import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import attendanceApp from "./attendance.index";
import {
  clockInSchema,
  clockOutSchema,
  listAttendanceQuery,
  createShiftBlockSchema,
} from "./attendance.schema";
import { AttendanceService } from "./attendance.service";
import type { AppEnv } from "../../types";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache } from "../../middlewares/rbac";

function mountAttendanceApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/attendance", attendanceApp);
  return app;
}

async function attendanceToken(
  db: ReturnType<typeof createMockDb>,
  flags: Partial<{
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }>
) {
  vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
    {
      featureCode: "ATTENDANCE",
      canCreate: flags.canCreate ?? false,
      canRead: flags.canRead ?? false,
      canUpdate: flags.canUpdate ?? false,
      canDelete: flags.canDelete ?? false,
    },
  ] as never);

  return sign(
    {
      sub: "staff-1",
      organizationId: "org-1",
      tenantRoleId: "role-att",
      branchId: "b1",
      isCustomer: false,
      scope: "BRANCH",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.JWT_SECRET!
  );
}

describe("attendance.schema", () => {
  it("clockInSchema requires branchId", () => {
    expect(clockInSchema.safeParse({ branchId: "" }).success).toBe(false);
    expect(clockInSchema.safeParse({ branchId: "b1" }).success).toBe(true);
  });

  it("clockOutSchema allows optional notes", () => {
    expect(clockOutSchema.parse({})).toEqual({});
  });

  it("listAttendanceQuery coerces pagination", () => {
    const q = listAttendanceQuery.parse({ page: "2", limit: "5" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
  });

  it("createShiftBlockSchema validates date format", () => {
    expect(
      createShiftBlockSchema.safeParse({
        staffProfileId: "sp1",
        date: "bad",
        startTime: "09:00",
        endTime: "17:00",
      }).success
    ).toBe(false);
    expect(
      createShiftBlockSchema.safeParse({
        staffProfileId: "sp1",
        date: "2025-06-01",
        startTime: "09:00",
        endTime: "17:00",
      }).success
    ).toBe(true);
  });
});

describe("AttendanceService", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("clockIn throws when no staff profile", async () => {
    vi.mocked(db.staffProfile.findUnique).mockResolvedValue(null);
    await expect(
      AttendanceService.clockIn(db, "u1", { branchId: "b1" })
    ).rejects.toThrow(/Staff profile not found/i);
  });

  it("clockIn throws when already clocked in", async () => {
    vi.mocked(db.staffProfile.findUnique).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
    } as never);
    vi.mocked(db.staffAttendance.findFirst).mockResolvedValue({ id: "a1" } as never);
    await expect(
      AttendanceService.clockIn(db, "u1", { branchId: "b1" })
    ).rejects.toThrow(/Already clocked in/i);
  });

  it("clockOut throws when already clocked out", async () => {
    vi.mocked(db.staffAttendance.findUnique).mockResolvedValue({
      id: "a1",
      staffProfileId: "sp1",
      clockOut: new Date(),
    } as never);
    await expect(
      AttendanceService.clockOut(db, "a1", {})
    ).rejects.toThrow(/Already clocked out/i);
  });
});

describe("attendance HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    invalidatePermissionCache("role-att");
    vi.clearAllMocks();
  });

  it("GET /attendance returns 401 without token", async () => {
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance");
    expect(res.status).toBe(401);
  });

  it("GET /attendance returns 403 without read permission", async () => {
    const t = await attendanceToken(db, {});
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance", {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status).toBe(403);
  });

  it("GET /attendance returns 200 with read permission", async () => {
    const t = await attendanceToken(db, { canRead: true });
    vi.mocked(db.staffAttendance.count).mockResolvedValue(0);
    vi.mocked(db.staffAttendance.findMany).mockResolvedValue([]);
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance", {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status).toBe(200);
  });

  it("POST /attendance/clock-in returns 403 without create permission", async () => {
    const t = await attendanceToken(db, { canRead: true });
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance/clock-in", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId: "b1" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /attendance/clock-in returns 201 when allowed and service succeeds", async () => {
    const t = await attendanceToken(db, { canCreate: true });
    vi.mocked(db.staffProfile.findUnique).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
    } as never);
    vi.mocked(db.staffAttendance.findFirst).mockResolvedValue(null);
    vi.mocked(db.staffAttendance.create).mockResolvedValue({
      id: "att1",
      staffProfileId: "sp1",
    } as never);
    vi.mocked(db.staffProfile.update).mockResolvedValue({ id: "sp1" } as never);
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance/clock-in", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId: "b1" }),
    });
    expect(res.status).toBe(201);
  });

  it("GET /attendance/shifts returns 200 with auth only", async () => {
    const t = await sign(
      {
        sub: "any",
        organizationId: "org-1",
        tenantRoleId: "role-x",
        branchId: null,
        isCustomer: false,
        scope: "HQ",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!
    );
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    vi.mocked(db.shiftSchedule.findMany).mockResolvedValue([]);
    const app = mountAttendanceApp(db);
    const res = await app.request("http://test/attendance/shifts", {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status).toBe(200);
  });
});
