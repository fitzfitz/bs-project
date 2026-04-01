import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useAttendance,
  useShifts,
  useCreateShift,
  useDeleteShift,
} from "../api/use-attendance";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function withClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("attendance feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    qc = createQueryClient();
  });

  describe("useAttendance", () => {
    it("fetches when branchId is provided", async () => {
      server.use(
        http.get(`${API}/attendance`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      const { result } = renderHook(
        () => useAttendance({ branchId: "b1" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("fetches when staffProfileId is provided without branchId", async () => {
      server.use(
        http.get(`${API}/attendance`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("staffProfileId")).toBe(
            "sp1"
          );
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      const { result } = renderHook(
        () => useAttendance({ staffProfileId: "sp1" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("is loading while the attendance request is in flight", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`${API}/attendance`, async () => {
          await gate;
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      const { result } = renderHook(
        () => useAttendance({ branchId: "b1" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(true));
      expect(result.current.isPending).toBe(true);
      expect(result.current.isLoading).toBe(true);
      release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("surfaces error when attendance request returns 500", async () => {
      server.use(
        http.get(`${API}/attendance`, () =>
          HttpResponse.json(
            { message: "Attendance service failed" },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(
        () => useAttendance({ branchId: "b1" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toBe(
        "Attendance service failed"
      );
    });

    it("is disabled when neither branch nor staff is set", () => {
      let hit = false;
      server.use(
        http.get(`${API}/attendance`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      renderHook(() => useAttendance({}), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });
  });

  describe("useShifts", () => {
    it("loads shifts for params", async () => {
      server.use(
        http.get(`${API}/attendance/shifts`, ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("branchId")).toBe("b1");
          expect(u.searchParams.get("date")).toBe("2025-06-01");
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      const { result } = renderHook(
        () => useShifts({ branchId: "b1", date: "2025-06-01" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("mutations", () => {
    it("useCreateShift invalidates shifts", async () => {
      let shiftFetches = 0;
      server.use(
        http.get(`${API}/attendance/shifts`, () => {
          shiftFetches += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.post(`${API}/attendance/shifts`, async ({ request }) => {
          const body = (await request.json()) as { staffProfileId: string };
          expect(body.staffProfileId).toBe("sp1");
          return HttpResponse.json({
            success: true,
            data: {
              id: "sh1",
              staffProfileId: "sp1",
              date: "2025-06-01",
              startTime: "09:00",
              endTime: "17:00",
              note: null,
            },
          });
        })
      );

      renderHook(() => useShifts({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });
      await waitFor(() => expect(shiftFetches).toBe(1));

      const { result: mut } = renderHook(() => useCreateShift(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({
          staffProfileId: "sp1",
          branchId: "b1",
          date: "2025-06-01",
          startTime: "09:00",
          endTime: "17:00",
        });
      });

      await waitFor(() => expect(shiftFetches).toBeGreaterThanOrEqual(2));
    });

    it("useDeleteShift invalidates shifts", async () => {
      let shiftFetches = 0;
      server.use(
        http.get(`${API}/attendance/shifts`, () => {
          shiftFetches += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.delete(`${API}/attendance/shifts/:id`, () =>
          HttpResponse.json({ success: true, data: {} })
        )
      );

      renderHook(() => useShifts({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });
      await waitFor(() => expect(shiftFetches).toBe(1));

      const { result: mut } = renderHook(() => useDeleteShift(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync("sh99");
      });

      await waitFor(() => expect(shiftFetches).toBeGreaterThanOrEqual(2));
    });
  });
});
