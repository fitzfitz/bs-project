import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { CommissionOverview } from "../widgets/commission-overview";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("commissions feature", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("renders earnings rows", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/commissions`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("page")).toBe("1");
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: "e1",
              staffProfileId: "sp1",
              date: "2025-03-01",
              commissionBase: 100000,
              commission: 10000,
              tips: 5000,
              total: 115000,
              staff: { id: "sp1", user: { firstName: "Alex", lastName: "Lee" } },
            },
          ],
          pagination: { page: 1, totalPages: 3, total: 25 },
        });
      })
    );

    render(
      <QueryClientProvider client={client}>
        <CommissionOverview page={1} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Alex Lee")).toBeInTheDocument());
    expect(screen.getByText("Earnings")).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/commissions`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <CommissionOverview page={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No earnings data found/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while earnings fetch", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/commissions`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: "e1",
              staffProfileId: "sp1",
              date: "2025-03-01",
              commissionBase: 100000,
              commission: 10000,
              tips: 5000,
              total: 115000,
              staff: { id: "sp1", user: { firstName: "Alex", lastName: "Lee" } },
            },
          ],
          pagination: { page: 1, totalPages: 1, total: 1 },
        });
      })
    );

    render(
      <QueryClientProvider client={client}>
        <CommissionOverview page={1} />
      </QueryClientProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Alex Lee")).toBeInTheDocument());
  });

  it("shows error on HTTP 500", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/commissions`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    render(
      <QueryClientProvider client={client}>
        <CommissionOverview page={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
    });
  });

  it("shows error on failure", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/commissions`, () =>
        HttpResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <CommissionOverview page={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Forbidden/i)).toBeInTheDocument();
    });
  });
});
