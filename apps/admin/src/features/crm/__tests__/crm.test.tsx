import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrmDashboard } from "../widgets/crm-dashboard";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

const sampleCustomer = {
  customerId: "c1",
  customerName: "Alex Customer",
  email: "alex@example.com",
  totalVisits: 5,
  totalSpend: 500_000,
  averageSpend: 100_000,
  lastVisitAt: "2025-01-15T10:00:00.000Z",
  daysSinceLastVisit: 12,
  favoriteServices: ["Cut", "Shave"],
  loyaltyTier: "GOLD",
  segment: "VIP",
};

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function mockCrmHandlers(customersDelay = 0) {
  server.use(
    http.get(`${API}/crm/customers`, async ({ request }) => {
      const u = new URL(request.url);
      if (u.searchParams.get("branchId") !== "b1") {
        return HttpResponse.json(
          { success: false, message: "branch required" },
          { status: 400 }
        );
      }
      if (customersDelay > 0) {
        await new Promise((r) => setTimeout(r, customersDelay));
      }
      return HttpResponse.json({
        success: true,
        data: [sampleCustomer],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    }),
    http.get(`${API}/crm/segments`, ({ request }) => {
      const u = new URL(request.url);
      if (u.searchParams.get("branchId") !== "b1") {
        return HttpResponse.json(
          { success: false, message: "branch required" },
          { status: 400 }
        );
      }
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: "s1",
            name: "VIP",
            memberCount: 3,
            isAutomatic: true,
          },
        ],
      });
    }),
    http.get(`${API}/crm/customers/:id`, ({ request, params }) => {
      const u = new URL(request.url);
      if (u.searchParams.get("branchId") !== "b1") {
        return HttpResponse.json(
          { success: false, message: "branch required" },
          { status: 400 }
        );
      }
      if (params.id === "c1") {
        return HttpResponse.json({ success: true, data: sampleCustomer });
      }
      return HttpResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }),
    http.post(`${API}/crm/segments/recompute`, async () =>
      HttpResponse.json({
        success: true,
        data: { segmentsProcessed: 2, totalAssigned: 5 },
      })
    )
  );
}

describe("crm feature", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("shows loading while customers are fetching", async () => {
    mockCrmHandlers(80);
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading customers/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alex Customer")).toBeInTheDocument();
    });
  });

  it("shows error when customers request fails", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/crm/customers`, () =>
        HttpResponse.json(
          { success: false, message: "Server exploded" },
          { status: 500 }
        )
      ),
      http.get(`${API}/crm/segments`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Server exploded/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no customers", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/crm/customers`, ({ request }) => {
        const u = new URL(request.url);
        if (u.searchParams.get("branchId") !== "b1") {
          return HttpResponse.json({ success: false, message: "bad" }, { status: 400 });
        }
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }),
      http.get(`${API}/crm/segments`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.post(`${API}/crm/segments/recompute`, () =>
        HttpResponse.json({
          success: true,
          data: { segmentsProcessed: 0, totalAssigned: 0 },
        })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No customers match the current filters/i)
      ).toBeInTheDocument();
    });
  });

  it("renders customer row and segment card", async () => {
    mockCrmHandlers(0);
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Alex Customer")).toBeInTheDocument());
    expect(screen.getAllByText("VIP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3 members/i)).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
  });

  it("opens detail dialog with favorite services", async () => {
    const user = userEvent.setup();
    mockCrmHandlers(0);
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Alex Customer")).toBeInTheDocument());
    await user.click(screen.getByText("Alex Customer"));

    await waitFor(() => {
      expect(screen.getByText("Favorite services")).toBeInTheDocument();
    });
    expect(screen.getByText("Cut")).toBeInTheDocument();
    expect(screen.getByText("Shave")).toBeInTheDocument();
  });

  it("runs recompute and shows summary text", async () => {
    const user = userEvent.setup();
    mockCrmHandlers(0);
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <CrmDashboard branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Alex Customer")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Recompute segments/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Updated 2 segments · 5 assignments/i)
      ).toBeInTheDocument();
    });
  });
});
