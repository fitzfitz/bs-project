import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockDb,
  mountFeatureWithDb,
  withPrismaScopeChain,
  signTestJwt,
  mockTenantRolePermissions,
  getTestBindings,
} from "../../test/helpers";
import {
  globalDashboardQuery,
  branchComparisonQuery,
  peakHourQuery,
  retentionQuery,
  forecastQuery,
  computeSnapshotsBody,
  utilizationQuery,
} from "./analytics.schema";
import { AnalyticsService } from "./analytics.service";
import analyticsApp from "./analytics.index";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("analytics.schema", () => {
  it("accepts optional date on globalDashboardQuery", () => {
    expect(globalDashboardQuery.safeParse({}).success).toBe(true);
    expect(globalDashboardQuery.safeParse({ date: "2025-01-15" }).success).toBe(true);
  });

  it("requires dateFrom/dateTo on branchComparisonQuery", () => {
    expect(branchComparisonQuery.safeParse({ dateFrom: "a", dateTo: "b" }).success).toBe(true);
    expect(branchComparisonQuery.safeParse({ dateFrom: "a" }).success).toBe(false);
  });

  it("defaults metric on branchComparisonQuery", () => {
    const r = branchComparisonQuery.parse({ dateFrom: "a", dateTo: "b" });
    expect(r.metric).toBe("revenue");
  });

  it("coerces periods on forecastQuery", () => {
    const r = forecastQuery.parse({ branchId: "b1", periods: "6" as unknown as number });
    expect(r.periods).toBe(6);
    expect(forecastQuery.safeParse({ branchId: "b1", periods: 0 }).success).toBe(false);
    expect(forecastQuery.safeParse({ branchId: "b1", periods: 13 }).success).toBe(false);
  });

  it("parses utilizationQuery", () => {
    expect(utilizationQuery.safeParse({ dateFrom: "a", dateTo: "b" }).success).toBe(true);
  });

  it("parses retention cohortMonth", () => {
    expect(retentionQuery.safeParse({ cohortMonth: "2025-01" }).success).toBe(true);
  });

  it("parses peakHourQuery", () => {
    expect(peakHourQuery.safeParse({ dateFrom: "a", dateTo: "b" }).success).toBe(true);
  });

  it("parses computeSnapshotsBody", () => {
    expect(computeSnapshotsBody.safeParse({}).success).toBe(true);
  });
});

describe("AnalyticsService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getGlobalDashboard aggregates branches and totals", async () => {
    const day = new Date("2025-03-01T00:00:00.000Z");
    (db.branch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "br1",
        name: "Main",
        isEmergencyClosed: false,
        averageRating: 4.5,
      },
    ]);
    (db.branchDailySnapshot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalRevenue: 100,
      transactionCount: 2,
    });
    (db.staffAttendance.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (db.queueEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (db.anomalyFlag.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await AnalyticsService.getGlobalDashboard(db, "2025-03-01");

    expect(result.branches).toHaveLength(1);
    expect(result.branches[0].revenue).toBe(100);
    expect(result.totals.totalRevenue).toBe(100);
    expect(result.totals.totalQueueEntries).toBe(3);
    expect(result.date).toBe(day.toISOString().slice(0, 10));
  });

  it("getBranchComparison uses all active branches when branchIds empty", async () => {
    (db.branch.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: "b1" }, { id: "b2" }])
      .mockResolvedValueOnce([
        { id: "b1", name: "A" },
        { id: "b2", name: "B" },
      ]);
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        date: new Date("2025-01-01"),
        totalRevenue: 10,
        transactionCount: 1,
        avgTransValue: 10,
        customerCount: 1,
      },
    ]);

    const out = await AnalyticsService.getBranchComparison(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      metric: "revenue",
    });

    expect(out).toHaveLength(2);
  });

  it("getPeakHeatmap builds 7x24 grid", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { createdAt: new Date("2025-01-01T10:00:00.000Z") },
    ]);
    const out = await AnalyticsService.getPeakHeatmap(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-02",
    });
    expect(out.heatmap.length).toBe(7);
    expect(out.heatmap[0].length).toBe(24);
  });

  it("getRetentionCohort returns empty when no customers", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const out = await AnalyticsService.getRetentionCohort(db, {
      cohortMonth: "2025-01",
    });
    expect(out.cohortSize).toBe(0);
    expect(out.returnRates).toEqual([]);
  });

  it("getRevenueForecast returns empty forecast when insufficient history", async () => {
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { date: new Date("2025-01-01"), totalRevenue: 100 },
    ]);
    const out = await AnalyticsService.getRevenueForecast(db, {
      branchId: "b1",
      periods: 3,
    });
    expect(out.forecast).toEqual([]);
  });

  it("getUtilization returns overall rate", async () => {
    (db.staffAttendance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        staffProfileId: "s1",
        clockIn: new Date("2025-01-01T08:00:00.000Z"),
        clockOut: new Date("2025-01-01T10:00:00.000Z"),
        staff: { user: { firstName: "A", lastName: "B", branchId: "b1" } },
      },
    ]);
    (db.queueEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        staffProfileId: "s1",
        startedAt: new Date("2025-01-01T08:30:00.000Z"),
        completedAt: new Date("2025-01-01T09:00:00.000Z"),
      },
    ]);
    const out = await AnalyticsService.getUtilization(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-01",
    });
    expect(out.barbers).toHaveLength(1);
    expect(out.overallRate).toBeGreaterThanOrEqual(0);
  });

  it("computeDailySnapshots upserts per branch", async () => {
    (db.branch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "b1", organizationId: "org-1" },
    ]);
    (db.transaction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { netAmount: 100, taxAmount: 10, tipAmount: 5 },
    });
    (db.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { customerId: "c1" },
    ]);
    (db.queueEntry.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { source: "WALK_IN", _count: 1 },
    ]);
    (db.branchDailySnapshot.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const out = await AnalyticsService.computeDailySnapshots(db, "2025-01-01");
    expect(out.branchesProcessed).toBe(1);
    expect(db.branchDailySnapshot.upsert).toHaveBeenCalled();
  });
});

describe("ForecastService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("returns empty when insufficient history", async () => {
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { ForecastService } = await import("./forecast.service");
    const result = await ForecastService.computeForecasts(db, "b1", "org-1");
    expect(result.forecastDays).toBe(0);
  });

  it("generates 14 days of forecasts with sufficient history", async () => {
    const snapshots = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 30 + i);
      d.setUTCHours(0, 0, 0, 0);
      return {
        id: `snap-${i}`,
        branchId: "b1",
        date: d,
        totalRevenue: 1000000 + Math.random() * 500000,
        transactionCount: 20 + Math.floor(Math.random() * 10),
        serviceRevenue: 800000,
        productRevenue: 200000,
        totalTips: 50000,
        customerCount: 15,
        walkInCount: 5,
        onlineCount: 10,
        avgTransValue: 50000,
      };
    });
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(snapshots);
    (db.branchHoliday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.demandForecast.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { ForecastService } = await import("./forecast.service");
    const result = await ForecastService.computeForecasts(db, "b1", "org-1");
    expect(result.forecastDays).toBe(14);
    expect(db.demandForecast.upsert).toHaveBeenCalledTimes(14);
  });

  it("getForecasts returns formatted data", async () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    (db.demandForecast.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        date: d,
        predictedTransactions: 25,
        predictedRevenue: 5000000,
        confidenceLow: 3500000,
        confidenceHigh: 6500000,
        dayOfWeek: 3,
        isHoliday: false,
      },
    ]);
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { ForecastService } = await import("./forecast.service");
    const result = await ForecastService.getForecasts(db, "b1");
    expect(result.forecasts).toHaveLength(1);
    expect(result.forecasts[0].predictedRevenue).toBe(5000000);
    expect(result.accuracy).toBeDefined();
  });
});

describe("SchedulingService", () => {
  it("returns 0 suggestions when no forecasts", async () => {
    const db = createMockDb();
    (db.scheduleSuggestion.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.demandForecast.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { SchedulingService } = await import("./scheduling.service");
    const result = await SchedulingService.computeSuggestions(db, "b1", "org-1");
    expect(result.suggestionsCreated).toBe(0);
  });
});

describe("ChurnService", () => {
  it("returns empty when no transactions", async () => {
    const db = createMockDb();
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { ChurnService } = await import("./churn.service");
    const result = await ChurnService.computeChurnScores(db, "b1", "org-1");
    expect(result.customersScored).toBe(0);
  });

  it("getChurnScores paginates results", async () => {
    const db = createMockDb();
    (db.churnScore.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        customerId: "c1",
        score: 0.8,
        riskLevel: "CRITICAL",
        features: {},
        computedAt: new Date(),
        customer: { id: "c1", firstName: "A", lastName: "B", email: "a@b.com" },
      },
    ]);
    (db.churnScore.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const { ChurnService } = await import("./churn.service");
    const result = await ChurnService.getChurnScores(db, "b1", { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].riskLevel).toBe("CRITICAL");
    expect(result.pagination.total).toBe(1);
  });

  it("getCustomerChurnScore returns null when not found", async () => {
    const db = createMockDb();
    (db.churnScore.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { ChurnService } = await import("./churn.service");
    const result = await ChurnService.getCustomerChurnScore(db, "c1", "b1");
    expect(result).toBeNull();
  });
});

describe("analytics HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(analyticsApp, db);
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization", async () => {
    const res = await app.request("/dashboard", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("returns 403 when RBAC denies ANALYTICS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-x",
      scope: "HQ",
    });
    const res = await app.request(
      "/dashboard",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 dashboard when permitted and data mocked", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ANALYTICS", canRead: true }]);
    (db.branch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.anomalyFlag.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-x",
      scope: "HQ",
    });
    const res = await app.request(
      "/dashboard",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { branches: unknown[] } };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.branches)).toBe(true);
  });
});
