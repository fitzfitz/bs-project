import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DashboardOverview } from "../widgets/dashboard-overview";
import { BarberDashboard } from "../widgets/barber-dashboard";
import { useBranchStore } from "@/store/use-branch-store";
import { useSessionStore } from "@/features/auth/store";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("dashboard feature", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-admin-branch");
    useBranchStore.setState({ selectedBranchId: null });
    localStorage.removeItem("tmng-admin-session");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  describe("DashboardOverview", () => {
    it("shows summary KPIs for selected branch and date", async () => {
      const client = createClient();
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({
            success: true,
            data: [{ id: "b1", name: "Main" }],
          })
        ),
        http.get(`${API}/transactions/summary`, ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("branchId")).toBe("b1");
          return HttpResponse.json({
            success: true,
            data: {
              count: 3,
              totalRevenue: 900000,
              totalServiceRevenue: 800000,
              totalProductRevenue: 50000,
              totalTips: 50000,
              paymentMethods: { CASH: 400000, QRIS: 500000 },
            },
          });
        })
      );

      render(
        <QueryClientProvider client={client}>
          <DashboardOverview />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText(/900[.,\s]000/)).toBeInTheDocument();
      });
      expect(screen.getByText(/CASH/)).toBeInTheDocument();
    });

    it("shows error when summary request fails", async () => {
      const client = createClient();
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/transactions/summary`, () =>
          HttpResponse.json({ success: false, message: "denied" }, { status: 403 })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <DashboardOverview />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/denied/i)).toBeInTheDocument();
      });
    });

    it("shows loading before summary resolves", async () => {
      const client = createClient();
      useBranchStore.setState({ selectedBranchId: "b1" });
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/transactions/summary`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({
            success: true,
            data: {
              count: 1,
              totalRevenue: 100,
              totalServiceRevenue: 100,
              totalProductRevenue: 0,
              totalTips: 0,
              paymentMethods: {},
            },
          });
        })
      );

      render(
        <QueryClientProvider client={client}>
          <DashboardOverview />
        </QueryClientProvider>
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      });
    });

    it("shows error when summary returns HTTP 500", async () => {
      const client = createClient();
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/transactions/summary`, () =>
          HttpResponse.json(
            { success: false, message: "Internal Server Error" },
            { status: 500 }
          )
        )
      );

      render(
        <QueryClientProvider client={client}>
          <DashboardOverview />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
      });
    });

    it("refetches when date input changes", async () => {
      const client = createClient();
      const dates: string[] = [];
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/transactions/summary`, ({ request }) => {
          dates.push(new URL(request.url).searchParams.get("date") ?? "");
          return HttpResponse.json({
            success: true,
            data: {
              count: 1,
              totalRevenue: 1,
              totalServiceRevenue: 1,
              totalProductRevenue: 0,
              totalTips: 0,
              paymentMethods: {},
            },
          });
        })
      );

      render(
        <QueryClientProvider client={client}>
          <DashboardOverview />
        </QueryClientProvider>
      );

      await waitFor(() => expect(dates.length).toBeGreaterThanOrEqual(1));
      const dateInput = document.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();
      fireEvent.change(dateInput, { target: { value: "2024-05-01" } });

      await waitFor(() => {
        expect(dates.some((d) => d === "2024-05-01")).toBe(true);
      });
    });
  });

  describe("BarberDashboard", () => {
    it("prompts to select branch when none selected", () => {
      const client = createClient();
      useSessionStore.setState({
        accessToken: "t",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "Sam",
          lastName: "S",
          tenantRoleId: "tr",
          staffProfile: { id: "sp1", tier: "JUNIOR" },
        },
      });

      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [] })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <BarberDashboard />
        </QueryClientProvider>
      );

      expect(
        screen.getByText(/Select a branch to view your dashboard/i)
      ).toBeInTheDocument();
    });

    it("shows queue stats and upcoming clients when data loads", async () => {
      const client = createClient();
      useBranchStore.setState({ selectedBranchId: "b1" });
      useSessionStore.setState({
        accessToken: "t",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "Sam",
          lastName: "S",
          tenantRoleId: "tr",
          staffProfile: { id: "sp1", tier: "JUNIOR" },
        },
      });

      const today = new Date().toISOString().slice(0, 10);

      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/queue`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
          expect(new URL(request.url).searchParams.get("date")).toBe(today);
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: "q1",
                status: "WAITING",
                source: "WALK_IN",
                position: 1,
                scheduledFor: null,
                startTime: null,
                endTime: null,
                estimatedDuration: 30,
                estimatedWait: null,
                customerName: "Pat",
                notes: null,
                calledAt: null,
                startedAt: null,
                completedAt: null,
                createdAt: new Date().toISOString(),
                services: [
                  {
                    service: {
                      name: "Cut",
                      durationMinutes: 30,
                      basePrice: 80000,
                    },
                  },
                ],
              },
            ],
          });
        }),
        http.get(`${API}/commissions/me`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("dateFrom")).toBe(today);
          return HttpResponse.json({ success: true, data: [{ id: "e1" }] });
        })
      );

      render(
        <QueryClientProvider client={client}>
          <BarberDashboard />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome, Sam/)).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Pat")).toBeInTheDocument();
      });
      expect(screen.getByText("Cut")).toBeInTheDocument();
    });

    it("shows queue stats as loading placeholders until queue loads", async () => {
      const client = createClient();
      useBranchStore.setState({ selectedBranchId: "b1" });
      useSessionStore.setState({
        accessToken: "t",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "Sam",
          lastName: "S",
          tenantRoleId: "tr",
          staffProfile: { id: "sp1", tier: "JUNIOR" },
        },
      });

      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/queue`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.get(`${API}/commissions/me`, () =>
          HttpResponse.json({ success: true, data: [] })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <BarberDashboard />
        </QueryClientProvider>
      );

      const placeholders = screen.getAllByText("...");
      expect(placeholders.length).toBeGreaterThanOrEqual(2);

      await waitFor(() => {
        expect(screen.getByText(/Welcome, Sam/)).toBeInTheDocument();
      });
    });
  });
});
