import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsDashboard } from "../widgets/analytics-dashboard";
import { useBranchStore } from "@/store/use-branch-store";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsDashboard dateFrom="2025-01-01" dateTo="2025-01-31" />
    </QueryClientProvider>
  );
}

function heatmapMatrix() {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

describe("analytics feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    useBranchStore.setState({ selectedBranchId: "br-1" });
  });

  it("Overview tab shows totals from dashboard endpoint", async () => {
    server.use(
      http.get(`${API_BASE}/analytics/dashboard`, () =>
        HttpResponse.json({
          success: true,
          data: {
            totals: {
              totalRevenue: 5000,
              totalTransactions: 12,
              totalActiveBarbers: 3,
              totalQueueEntries: 4,
            },
            branches: [],
            alerts: [],
          },
        })
      )
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText(/Rp 5[.,]000/)).toBeInTheDocument();
  });

  it("Comparison tab loads branch comparison data", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/analytics/dashboard`, () =>
        HttpResponse.json({
          success: true,
          data: { totals: {}, branches: [], alerts: [] },
        })
      ),
      http.get(`${API_BASE}/analytics/comparison`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("metric")).toBe("revenue");
        return HttpResponse.json({
          success: true,
          data: [
            { branchId: "b1", branchName: "North", total: 100 },
            { branchId: "b2", branchName: "South", total: 50 },
          ],
        });
      })
    );

    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Comparison" }));

    await waitFor(() => {
      expect(screen.getByText("North")).toBeInTheDocument();
    });
    expect(screen.getByText("South")).toBeInTheDocument();
  });

  it("Peak Hours tab renders heatmap grid", async () => {
    const user = userEvent.setup();
    const hm = heatmapMatrix();
    hm[1][10] = 5;

    server.use(
      http.get(`${API_BASE}/analytics/dashboard`, () =>
        HttpResponse.json({ success: true, data: { totals: {}, branches: [], alerts: [] } })
      ),
      http.get(`${API_BASE}/analytics/heatmap`, () =>
        HttpResponse.json({
          success: true,
          data: { heatmap: hm },
        })
      )
    );

    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Peak Hours" }));

    await waitFor(() => {
      expect(screen.getByText("Peak Hour Heatmap")).toBeInTheDocument();
    });
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("Utilization tab shows overall rate and barber rows", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/analytics/dashboard`, () =>
        HttpResponse.json({ success: true, data: { totals: {}, branches: [], alerts: [] } })
      ),
      http.get(`${API_BASE}/analytics/utilization`, () =>
        HttpResponse.json({
          success: true,
          data: {
            overallRate: 75,
            totalAvailableMinutes: 480,
            totalBusyMinutes: 360,
            barbers: [
              {
                staffProfileId: "s1",
                name: "Alex",
                availableMinutes: 240,
                busyMinutes: 200,
                servicesCount: 8,
                utilizationRate: 83,
              },
            ],
          },
        })
      )
    );

    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Utilization" }));

    await waitFor(() => {
      expect(screen.getByText("Overall Utilization")).toBeInTheDocument();
    });
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("Retention tab shows cohort rates", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/analytics/dashboard`, () =>
        HttpResponse.json({ success: true, data: { totals: {}, branches: [], alerts: [] } })
      ),
      http.get(`${API_BASE}/analytics/retention`, () =>
        HttpResponse.json({
          success: true,
          data: {
            cohortSize: 40,
            returnRates: [
              { month: 0, rate: 1 },
              { month: 1, rate: 0.5 },
            ],
          },
        })
      )
    );

    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Retention" }));

    await waitFor(() => {
      expect(screen.getByText(/Cohort size: 40/)).toBeInTheDocument();
    });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
