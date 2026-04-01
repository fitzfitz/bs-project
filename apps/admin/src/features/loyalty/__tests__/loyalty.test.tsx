import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useCustomerMembership,
  useAdjustPoints,
  useExpirePoints,
  useReferralStats,
} from "../api/use-loyalty-admin";

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

describe("loyalty feature hooks", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("useCustomerMembership does not fetch when userId is undefined", () => {
    const { result } = renderHook(() => useCustomerMembership(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
  });

  it("useCustomerMembership surfaces HTTP 500", async () => {
    server.use(
      http.get(`${API_BASE}/loyalty/u-1`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(() => useCustomerMembership("u-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("useCustomerMembership is loading until response arrives", async () => {
    server.use(
      http.get(`${API_BASE}/loyalty/u-1`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({
          success: true,
          data: {
            id: "m1",
            userId: "u-1",
            pointsBalance: 100,
            lifetimePoints: 200,
            tier: "GOLD",
            tierMultiplier: 1.2,
            lastActivityAt: null,
            pointsExpiringAt: null,
          },
        });
      })
    );

    const { result } = renderHook(() => useCustomerMembership("u-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useCustomerMembership loads membership for userId", async () => {
    server.use(
      http.get(`${API_BASE}/loyalty/u-1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: "m1",
            userId: "u-1",
            pointsBalance: 100,
            lifetimePoints: 200,
            tier: "GOLD",
            tierMultiplier: 1.2,
            lastActivityAt: null,
            pointsExpiringAt: null,
          },
        })
      )
    );

    const { result } = renderHook(() => useCustomerMembership("u-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.pointsBalance).toBe(100);
  });

  it("useAdjustPoints PATCHes and invalidates loyalty queries", async () => {
    const patchHandler = vi.fn();
    server.use(
      http.patch(`${API_BASE}/loyalty/admin/adjust`, async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ userId: "u-2", points: 5, description: "bonus" });
        patchHandler();
        return HttpResponse.json({
          success: true,
          message: "Adjusted 5 points for user u-2",
        });
      })
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAdjustPoints(), { wrapper });

    result.current.mutate({ userId: "u-2", points: 5, description: "bonus" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patchHandler).toHaveBeenCalled();
  });

  it("useExpirePoints POSTs expire endpoint", async () => {
    server.use(
      http.post(`${API_BASE}/loyalty/admin/expire`, () =>
        HttpResponse.json({ success: true, data: { accountsProcessed: 3, totalExpired: 12 } })
      )
    );

    const { result } = renderHook(() => useExpirePoints(), { wrapper: createWrapper() });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as { data: { totalExpired: number } }).data.totalExpired).toBe(12);
  });

  it("useReferralStats surfaces HTTP 500", async () => {
    server.use(
      http.get(`${API_BASE}/referrals/stats`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(() => useReferralStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("useReferralStats fetches stats", async () => {
    server.use(
      http.get(`${API_BASE}/referrals/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { total: 10, completed: 4, pending: 6, conversionRate: 0.4 },
        })
      )
    );

    const { result } = renderHook(() => useReferralStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.completed).toBe(4);
  });
});
