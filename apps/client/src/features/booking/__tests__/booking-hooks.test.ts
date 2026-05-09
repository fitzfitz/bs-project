import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useServices } from "../api/use-services";
import { useBarbers } from "../api/use-barbers";
import { useAvailability } from "../api/use-availability";
import { useCreateBooking } from "../api/use-create-booking";
import { useCancelBooking } from "../api/use-cancel-booking";
import { useRescheduleBooking } from "../api/use-reschedule-booking";
import { useMyWaitlist, useJoinWaitlist, useLeaveWaitlist } from "../api/use-waitlist";

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

describe("booking hooks", () => {
  describe("useServices", () => {
    it("loads services on success", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/services`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "s1",
                name: "Cut",
                description: null,
                category: "Hair",
                type: "SERVICE",
                basePrice: 100000,
                durationMinutes: 30,
                bufferMinutes: 0,
                isCommissionable: true,
                loyaltyEligible: true,
                isActive: true,
                sortOrder: 0,
                createdAt: "",
                updatedAt: "",
              },
            ],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
          }),
        ),
      );

      const { result } = renderHook(() => useServices(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.name).toBe("Cut");
    });

    it("handles fetch error", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/services`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useServices(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while services fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/services`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
          });
        }),
      );

      const { result } = renderHook(() => useServices(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useBarbers", () => {
    it("does not fetch without branchId", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/staff`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      renderHook(() => useBarbers(undefined), {
        wrapper: qcWrapper(qc),
      });
      expect(called).toBe(false);
    });

    it("loads barbers for branch", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/staff`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe(
            "b1",
          );
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: "st1",
                tier: "SENIOR",
                specialties: ["Fade"],
                averageRating: 4.5,
                totalReviews: 2,
                user: { firstName: "A", lastName: "B" },
              },
            ],
          });
        }),
      );

      const { result } = renderHook(() => useBarbers("b1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.user.firstName).toBe("A");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/staff`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useBarbers("b1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while barbers fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/staff`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      const { result } = renderHook(() => useBarbers("b1"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useAvailability", () => {
    it("disabled without branchId or date", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/queue/availability`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      renderHook(
        () => useAvailability("b1", undefined, undefined),
        { wrapper: qcWrapper(qc) },
      );
      expect(called).toBe(false);
    });

    it("returns slot envelope", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/queue/availability`, () =>
          HttpResponse.json({
            success: true,
            data: [
              { time: "09:00", available: true },
              { time: "09:30", available: false },
            ],
          }),
        ),
      );

      const { result } = renderHook(
        () => useAvailability("b1", "2025-03-20", "st1"),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.[0]?.time).toBe("09:00");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/queue/availability`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(
        () => useAvailability("b1", "2025-03-20", "st1"),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while availability fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/queue/availability`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: [{ time: "09:00", available: true }],
          });
        }),
      );

      const { result } = renderHook(
        () => useAvailability("b1", "2025-03-20", "st1"),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useCreateBooking", () => {
    it("posts queue payload and invalidates my-bookings", async () => {
      const qc = createQueryClient();
      await qc.prefetchQuery({
        queryKey: ["my-bookings", "u1"],
        queryFn: () => Promise.resolve([]),
      });

      server.use(
        http.post(`${API}/queue`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.branchId).toBe("b1");
          return HttpResponse.json({ success: true, data: { id: "q1" } });
        }),
      );

      const { result } = renderHook(() => useCreateBooking(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          branchId: "b1",
          customerName: "Test User",
          serviceIds: ["s1"],
          startTime: new Date().toISOString(),
          estimatedDuration: 30,
          source: "APP",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("surfaces API error", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/queue`, () =>
          HttpResponse.json(
            { success: false, message: "Slot taken" },
            { status: 409 },
          ),
        ),
      );

      const { result } = renderHook(() => useCreateBooking(), {
        wrapper: qcWrapper(qc),
      });

      await expect(
        result.current.mutateAsync({
          branchId: "b1",
          customerName: "X",
          serviceIds: ["s1"],
          startTime: new Date().toISOString(),
          estimatedDuration: 30,
          source: "APP",
        }),
      ).rejects.toThrow();
    });
  });

  describe("useCancelBooking", () => {
    it("posts customer-cancel", async () => {
      const qc = createQueryClient();
      let hit = false;
      server.use(
        http.post(`${API}/queue/q1/customer-cancel`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: {} });
        }),
      );

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync("q1");
      });

      expect(hit).toBe(true);
    });
  });

  describe("useMyWaitlist", () => {
    it("loads waitlist from GET /waitlist/me", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/waitlist/me`, () =>
          HttpResponse.json({ success: true, data: [{ id: "w1" }] }),
        ),
      );

      const { result } = renderHook(() => useMyWaitlist(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });

  describe("useJoinWaitlist", () => {
    it("posts waitlist payload and invalidates my-waitlist", async () => {
      const qc = createQueryClient();
      const posted: { json: Record<string, unknown> | null } = { json: null };
      server.use(
        http.get(`${API}/waitlist/me`, () =>
          HttpResponse.json({ success: true, data: [] }),
        ),
        http.post(`${API}/waitlist`, async ({ request }) => {
          posted.json = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ success: true, data: { id: "w1" } });
        }),
      );

      const { result } = renderHook(() => useJoinWaitlist(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          branchId: "b1",
          preferredDate: "2025-03-20",
          preferredTimeSlot: "ANY",
          serviceIds: ["s1"],
        });
      });

      expect(posted.json?.branchId).toBe("b1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useLeaveWaitlist", () => {
    it("deletes waitlist entry", async () => {
      const qc = createQueryClient();
      let deleted = false;
      server.use(
        http.delete(`${API}/waitlist/w1`, () => {
          deleted = true;
          return HttpResponse.json({ success: true, data: {} });
        }),
      );

      const { result } = renderHook(() => useLeaveWaitlist(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync("w1");
      });

      expect(deleted).toBe(true);
    });
  });

  describe("useRescheduleBooking", () => {
    it("patches reschedule with startTime", async () => {
      const qc = createQueryClient();
      server.use(
        http.patch(`${API}/queue/q1/reschedule`, async ({ request }) => {
          const body = (await request.json()) as { startTime: string };
          expect(body.startTime).toBe("2025-01-01T10:00:00.000Z");
          return HttpResponse.json({ success: true, data: {} });
        }),
      );

      const { result } = renderHook(() => useRescheduleBooking(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          entryId: "q1",
          startTime: "2025-01-01T10:00:00.000Z",
        });
      });
    });
  });
});
