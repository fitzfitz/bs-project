import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { PayrollManager } from "../widgets/payroll-manager";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function renderManager(page: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PayrollManager page={page} />
    </QueryClientProvider>
  );
}

describe("payroll feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("shows loading while payroll fetch is in flight", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      })
    );

    renderManager(1);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No payroll periods found")).toBeInTheDocument();
    });
  });

  it("surfaces HTTP 500 error message", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    renderManager(1);

    await waitFor(() => {
      expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
    });
  });

  it("renders payroll rows and status badges", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: "p1",
              staffProfileId: "sp-abc",
              periodStart: "2025-01-01",
              periodEnd: "2025-01-15",
              totalPayout: 1_500_000,
              status: "APPROVED",
              staff: { user: { firstName: "Ada", lastName: "Lovelace" } },
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      })
    );

    renderManager(1);

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("shows empty state when no periods", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        })
      )
    );

    renderManager(1);

    await waitFor(() => {
      expect(screen.getByText("No payroll periods found")).toBeInTheDocument();
    });
  });

  it("falls back to truncated staffProfileId when staff missing", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "p2",
              staffProfileId: "sp-long-id-value",
              periodStart: "2025-02-01",
              periodEnd: "2025-02-15",
              totalPayout: 0,
              status: "DRAFT",
            },
          ],
        })
      )
    );

    renderManager(1);

    await waitFor(() => {
      // staffProfileId.slice(0, 8) + "..." => "sp-long-..."
      expect(screen.getByText(/sp-long-\.\.\./)).toBeInTheDocument();
    });
  });

  it("surfaces query error message", async () => {
    server.use(
      http.get(`${API_BASE}/payroll`, () =>
        HttpResponse.json({ success: false, message: "Payroll denied" }, { status: 403 })
      )
    );

    renderManager(1);

    await waitFor(() => {
      expect(screen.getByText(/Payroll denied/)).toBeInTheDocument();
    });
  });
});
