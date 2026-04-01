import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useTransactions, useTransaction, useVoidTransaction, useRefundTransaction } from "../api/use-transactions";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("transactions feature hooks", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("useTransactions does not fetch without branchId", () => {
    let hit = false;
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        hit = true;
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    const { result } = renderHook(
      () => useTransactions({ branchId: "" }),
      { wrapper: createWrapper() }
    );

    expect(hit).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
  });

  it("useTransactions passes filters in query string", async () => {
    let url = "";
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    const { result } = renderHook(
      () =>
        useTransactions({
          branchId: "br-x",
          dateFrom: "2025-01-01",
          dateTo: "2025-01-31",
          status: "COMPLETED",
          page: 2,
          limit: 5,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const u = new URL(url);
    expect(u.searchParams.get("branchId")).toBe("br-x");
    expect(u.searchParams.get("dateFrom")).toBe("2025-01-01");
    expect(u.searchParams.get("status")).toBe("COMPLETED");
    expect(u.searchParams.get("page")).toBe("2");
  });

  it("useTransactions surfaces error when list returns 500", async () => {
    server.use(
      http.get(`${API_BASE}/transactions`, () =>
        HttpResponse.json({ message: "Transactions failed" }, { status: 500 })
      )
    );

    const { result } = renderHook(
      () => useTransactions({ branchId: "br-x" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Transactions failed");
  });

  it("useTransaction fetches single row when id provided", async () => {
    server.use(
      http.get(`${API_BASE}/transactions/t-1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: "t-1",
            organizationId: "org-1",
            branchId: "br-1",
            status: "COMPLETED",
            grossAmount: 100,
            discountAmount: 0,
            taxAmount: 10,
            tipAmount: 0,
            netAmount: 110,
            totalDue: 110,
            loyaltyPointsUsed: 0,
            loyaltyPointsEarned: 0,
            promoCode: null,
            customerId: null,
            staffProfileId: null,
            queueEntryId: null,
            clientUuid: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        })
      )
    );

    const { result } = renderHook(() => useTransaction("t-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe("COMPLETED");
  });

  it("useVoidTransaction POSTs reason", async () => {
    const hit = vi.fn();
    server.use(
      http.post(`${API_BASE}/transactions/:id/void`, async ({ params, request }) => {
        hit(params.id, await request.json());
        return HttpResponse.json({
          success: true,
          data: {
            id: params.id as string,
            organizationId: "org-1",
            branchId: "br-1",
            status: "VOIDED",
            grossAmount: 0,
            discountAmount: 0,
            taxAmount: 0,
            tipAmount: 0,
            netAmount: 0,
            totalDue: 0,
            loyaltyPointsUsed: 0,
            loyaltyPointsEarned: 0,
            promoCode: null,
            customerId: null,
            staffProfileId: null,
            queueEntryId: null,
            clientUuid: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        });
      })
    );

    const { result } = renderHook(() => useVoidTransaction(), { wrapper: createWrapper() });

    result.current.mutate({ id: "t-2", reason: "customer request" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toHaveBeenCalledWith("t-2", { reason: "customer request" });
  });

  it("useRefundTransaction POSTs reason to refund endpoint", async () => {
    const hit = vi.fn();
    server.use(
      http.post(`${API_BASE}/transactions/:id/refund`, async ({ params, request }) => {
        hit(params.id, await request.json());
        return HttpResponse.json({
          success: true,
          data: {
            id: params.id as string,
            organizationId: "org-1",
            branchId: "br-1",
            status: "REFUNDED",
            grossAmount: 100,
            discountAmount: 0,
            taxAmount: 10,
            tipAmount: 0,
            netAmount: 110,
            totalDue: 110,
            loyaltyPointsUsed: 0,
            loyaltyPointsEarned: 0,
            promoCode: null,
            customerId: null,
            staffProfileId: null,
            queueEntryId: null,
            clientUuid: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        });
      })
    );

    const { result } = renderHook(() => useRefundTransaction(), { wrapper: createWrapper() });

    result.current.mutate({ id: "t-3", reason: "defective product" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toHaveBeenCalledWith("t-3", { reason: "defective product" });
  });

  it("useRefundTransaction surfaces error on failure", async () => {
    server.use(
      http.post(`${API_BASE}/transactions/:id/refund`, () =>
        HttpResponse.json({ message: "Only completed transactions can be refunded" }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useRefundTransaction(), { wrapper: createWrapper() });

    result.current.mutate({ id: "t-pending", reason: "customer request here" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
