import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useProfile,
  useUpdateProfile,
  useDeleteAccount,
} from "../api/use-profile";
import { useHistory } from "../api/use-history";
import { useLoyalty } from "../api/use-loyalty";
import { useReceipt } from "../api/use-receipt";
import { useNotifications } from "../api/use-notifications";
import { useSessionStore } from "@/features/auth/store";
import { UpdateProfileSchema } from "../types";

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

const mePayload = {
  id: "u1",
  firstName: "Pat",
  lastName: "Lee",
  email: "p@c.com",
  tenantRoleId: "tr1",
};

describe("profile feature", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-session-storage");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  describe("UpdateProfileSchema", () => {
    it("accepts valid update", () => {
      const r = UpdateProfileSchema.safeParse({
        firstName: "Jo",
        lastName: "Li",
        phone: "+62812",
      });
      expect(r.success).toBe(true);
    });
  });

  describe("useProfile", () => {
    it("disabled without session user", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/auth/me`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: mePayload });
        }),
      );

      renderHook(() => useProfile(), { wrapper: qcWrapper(qc) });
      expect(called).toBe(false);
    });

    it("returns profile data", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "Pat",
          lastName: "Lee",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/auth/me`, () =>
          HttpResponse.json({ success: true, data: mePayload }),
        ),
      );

      const { result } = renderHook(() => useProfile(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.firstName).toBe("Pat");
    });

    it("handles error", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/auth/me`, () =>
          HttpResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 },
          ),
        ),
      );

      const { result } = renderHook(() => useProfile(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUpdateProfile", () => {
    it("patches profile and updates session user", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "Pat",
          lastName: "Lee",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.patch(`${API}/auth/me`, async ({ request }) => {
          const body = (await request.json()) as Record<string, string>;
          expect(body.firstName).toBe("Patty");
          return HttpResponse.json({
            success: true,
            data: { ...mePayload, firstName: "Patty" },
          });
        }),
      );

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          firstName: "Patty",
          lastName: "Lee",
        });
      });

      expect(useSessionStore.getState().user?.firstName).toBe("Patty");
    });
  });

  describe("useDeleteAccount", () => {
    it("sends confirm body and clears session", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.delete(`${API}/auth/me`, async ({ request }) => {
          const body = (await request.json()) as { confirm: string };
          expect(body.confirm).toBe("DELETE");
          return HttpResponse.json({
            success: true,
            data: { message: "Deleted" },
          });
        }),
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(useSessionStore.getState().user).toBeNull();
    });
  });

  describe("useHistory", () => {
    it("fetches queue me when logged in", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/queue/me`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "q1",
                organizationId: "org1",
                branchId: "b1",
                staffProfileId: null,
                bookingId: null,
                customerId: "u1",
                status: "COMPLETED",
                source: "WALK_IN",
                position: 1,
                customerName: "P L",
                estimatedWait: null,
                calledAt: null,
                startedAt: null,
                completedAt: "2025-01-01T10:30:00.000Z",
                createdAt: "2025-01-01T09:00:00.000Z",
                updatedAt: "2025-01-01T10:30:00.000Z",
                staff: null,
                branch: { id: "b1", name: "Main", address: "123 St", city: "Jakarta" },
                booking: null,
                transaction: null,
              },
            ],
          }),
        ),
      );

      const { result } = renderHook(() => useHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.id).toBe("q1");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/queue/me`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while history fetch is in flight", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/queue/me`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      const { result } = renderHook(() => useHistory(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useLoyalty", () => {
    it("returns loyalty envelope", async () => {
      const qc = createQueryClient();
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "p@c.com",
          firstName: "P",
          lastName: "L",
          tenantRoleId: "tr1",
        },
        "tok",
        "ref",
      );

      server.use(
        http.get(`${API}/loyalty/me`, () =>
          HttpResponse.json({
            success: true,
            data: {
              id: "m1",
              userId: "u1",
              pointsBalance: 10,
              lifetimePoints: 10,
              tier: "BRONZE",
              tierMultiplier: 1,
              pointsExpiringAt: null,
              lastActivityAt: null,
              createdAt: "",
            },
          }),
        ),
      );

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.tier).toBe("BRONZE");
    });
  });

  describe("useReceipt", () => {
    it("disabled without transaction id", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/transactions/t1/receipt`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: {} });
        }),
      );

      renderHook(() => useReceipt(undefined), {
        wrapper: qcWrapper(qc),
      });
      expect(called).toBe(false);
    });

    it("loads receipt", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/transactions/t1/receipt`, () =>
          HttpResponse.json({
            success: true,
            data: {
              receiptNumber: "R1",
              date: "2025-01-01",
              branchId: "b1",
              branchName: "Main",
              branchAddress: "Jl",
              cashierName: "C",
              staffProfileId: null,
              staffName: null,
              queueEntryId: null,
              items: [],
              subtotal: 0,
              discountTotal: 0,
              tax: 0,
              tip: 0,
              grandTotal: 0,
              payments: [],
              loyaltyPointsEarned: 0,
            },
          }),
        ),
      );

      const { result } = renderHook(() => useReceipt("t1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.receiptNumber).toBe("R1");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/transactions/t1/receipt`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useReceipt("t1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while receipt fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/transactions/t1/receipt`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: {
              receiptNumber: "R1",
              date: "2025-01-01",
              branchId: "b1",
              branchName: "Main",
              branchAddress: "Jl",
              cashierName: "C",
              staffProfileId: null,
              staffName: null,
              queueEntryId: null,
              items: [],
              subtotal: 0,
              discountTotal: 0,
              tax: 0,
              tip: 0,
              grandTotal: 0,
              payments: [],
              loyaltyPointsEarned: 0,
            },
          });
        }),
      );

      const { result } = renderHook(() => useReceipt("t1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useNotifications", () => {
    it("returns default context without provider", () => {
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isPushEnabled).toBe(false);
    });
  });
});
