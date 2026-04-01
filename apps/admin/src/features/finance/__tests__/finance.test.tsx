import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { FinanceOverview } from "../widgets/finance-overview";
import { usePLSummary } from "../api/use-finance";
import { useBranchStore } from "@/store/use-branch-store";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

const samplePl = {
  period: { from: "2025-01-01", to: "2025-01-31" },
  revenue: {
    serviceRevenue: 100,
    productRevenue: 50,
    tipsCollected: 10,
    totalRevenue: 160,
  },
  costs: {
    totalCommissions: 20,
    totalPayroll: 30,
    inventoryCOGS: 10,
    totalCosts: 60,
  },
  grossProfit: 100,
  margins: { grossMarginPercent: 62.5 },
  taxes: { ppnCollected: 15 },
  discountsGiven: 5,
  voidsTotal: 2,
};

function createFinanceClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderOverview(props: { dateFrom: string; dateTo: string }) {
  const client = createFinanceClient();
  return render(
    <QueryClientProvider client={client}>
      <FinanceOverview {...props} />
    </QueryClientProvider>
  );
}

function plWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("finance feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    useBranchStore.setState({ selectedBranchId: null });
  });

  it("usePLSummary surfaces HTTP 500", async () => {
    const qc = createFinanceClient();
    server.use(
      http.get(`${API_BASE}/finance/pl`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(
      () => usePLSummary({ dateFrom: "2025-01-01", dateTo: "2025-01-31" }),
      { wrapper: plWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("shows loading skeleton while P&L request is in flight", async () => {
    server.use(
      http.get(`${API_BASE}/finance/pl`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({ success: true, data: samplePl });
      })
    );

    renderOverview({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });

    expect(document.querySelector(".animate-pulse")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });
  });

  it("renders P&L summary when API returns data", async () => {
    server.use(
      http.get(`${API_BASE}/finance/pl`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("dateFrom")).toBe("2025-01-01");
        expect(url.searchParams.get("dateTo")).toBe("2025-01-31");
        return HttpResponse.json({ success: true, data: samplePl });
      })
    );

    renderOverview({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });

    await waitFor(() => {
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText(/Rp 160/)).toBeInTheDocument();
    expect(screen.getByText("Gross Profit")).toBeInTheDocument();
  });

  it("appends branchId when branch is selected", async () => {
    useBranchStore.setState({ selectedBranchId: "br-99" });

    server.use(
      http.get(`${API_BASE}/finance/pl`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("branchId")).toBe("br-99");
        return HttpResponse.json({ success: true, data: samplePl });
      })
    );

    renderOverview({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });

    await waitFor(() => expect(screen.getByText("Total Revenue")).toBeInTheDocument());
  });

  it("shows empty message when data is missing", async () => {
    server.use(
      http.get(`${API_BASE}/finance/pl`, () =>
        HttpResponse.json({ success: true, data: null as unknown as null })
      )
    );

    renderOverview({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });

    await waitFor(() => {
      expect(screen.getByText(/No financial data available/)).toBeInTheDocument();
    });
  });

  it("highlights loss when gross profit negative", async () => {
    server.use(
      http.get(`${API_BASE}/finance/pl`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...samplePl,
            grossProfit: -10,
            margins: { grossMarginPercent: -5 },
          },
        })
      )
    );

    renderOverview({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });

    await waitFor(() => expect(screen.getByText(/-Rp\s*10/)).toBeInTheDocument());
    const lossCard = screen.getByText(/-Rp\s*10/).closest(".border-red-200");
    expect(lossCard).toBeTruthy();
  });
});
