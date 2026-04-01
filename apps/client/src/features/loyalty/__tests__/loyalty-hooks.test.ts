import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useLoyaltyAccount } from "../api/use-loyalty-account";
import { useLoyaltyHistory } from "../api/use-loyalty-history";
import { useReferralCode } from "../api/use-referral-code";
import { useReferralHistory } from "../api/use-referral-history";
import { useSessionStore } from "@/features/auth/store";

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function qcWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

const membership = {
  id: "m1",
  userId: "u1",
  pointsBalance: 120,
  lifetimePoints: 400,
  tier: "SILVER" as const,
  tierMultiplier: 1.25,
  pointsExpiringAt: null,
  lastActivityAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("loyalty hooks", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-session-storage");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  describe("useLoyaltyAccount", () => {
    it("disabled when logged out", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/loyalty/me`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: membership });
        }),
      );

      renderHook(() => useLoyaltyAccount(), { wrapper: qcWrapper(qc) });
      expect(called).toBe(false);
    });

    it("loads account when user present", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/loyalty/me`, () =>
          HttpResponse.json({ success: true, data: membership }),
        ),
      );

      const { result } = renderHook(() => useLoyaltyAccount(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.tier).toBe("SILVER");
    });

    it("surfaces error", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/loyalty/me`, () =>
          HttpResponse.json(
            { success: false, message: "Nope" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useLoyaltyAccount(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useLoyaltyHistory", () => {
    it("requests pagination params", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/loyalty/me/history`, ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("page")).toBe("2");
          expect(u.searchParams.get("limit")).toBe("10");
          return HttpResponse.json({
            success: true,
            data: [],
            pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
          });
        }),
      );

      const { result } = renderHook(() => useLoyaltyHistory(2, 10), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useReferralCode", () => {
    it("returns referral code envelope", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/referrals/me/code`, () =>
          HttpResponse.json({
            success: true,
            data: { referralCode: "ABC123" },
          }),
        ),
      );

      const { result } = renderHook(() => useReferralCode(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.referralCode).toBe("ABC123");
    });
  });

  describe("useReferralHistory", () => {
    it("loads referral history", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/referrals/me/history`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "r1",
                status: "PENDING",
                bonusPoints: 10,
                refereeName: "Friend",
                completedAt: null,
                createdAt: "2025-01-01T00:00:00.000Z",
              },
            ],
          }),
        ),
      );

      const { result } = renderHook(() => useReferralHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.[0]?.refereeName).toBe("Friend");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/referrals/me/history`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useReferralHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while referral history fetch is in flight", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "t",
        "r",
      );

      server.use(
        http.get(`${API}/referrals/me/history`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      const { result } = renderHook(() => useReferralHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
