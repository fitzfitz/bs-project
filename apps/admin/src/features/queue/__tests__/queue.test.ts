import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useQueue,
  useUpdateQueueStatus,
  useAssignStaff,
  useCreateEntry,
  type QueueEntry,
} from "../api/use-queue";

const API = "http://localhost:8787/api";

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

const baseEntry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  id: "q1",
  organizationId: "org1",
  branchId: "b1",
  staffProfileId: null,
  bookingId: null,
  customerId: null,
  status: "WAITING",
  source: "WALK_IN",
  position: 1,
  customerName: "Walk",
  estimatedWait: null,
  calledAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  staff: null,
  booking: null,
  ...over,
});

describe("queue feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = createQueryClient();
  });

  describe("useQueue", () => {
    it("fetches queue when branchId is set", async () => {
      const rows = [baseEntry()];
      server.use(
        http.get(`${API}/queue`, ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("branchId")).toBe("b1");
          return HttpResponse.json({ success: true, data: rows });
        })
      );

      const { result } = renderHook(
        () => useQueue({ branchId: "b1", date: "2025-01-01" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data?.[0].id).toBe("q1");
    });

    it("is loading until queue response arrives", async () => {
      const rows = [baseEntry()];
      server.use(
        http.get(`${API}/queue`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({ success: true, data: rows });
        })
      );

      const { result } = renderHook(
        () => useQueue({ branchId: "b1", date: "2025-01-01" }),
        { wrapper: withClient(qc) }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("surfaces HTTP 500 from queue list", async () => {
      server.use(
        http.get(`${API}/queue`, () =>
          HttpResponse.json(
            { success: false, message: "Internal Server Error" },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(
        () => useQueue({ branchId: "b1", date: "2025-01-01" }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("does not fetch without branchId", () => {
      let hit = false;
      server.use(
        http.get(`${API}/queue`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      renderHook(() => useQueue({ branchId: "" }), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });
  });

  describe("useUpdateQueueStatus", () => {
    it("refetches queue with updated status after mutation", async () => {
      let rows: QueueEntry[] = [baseEntry({ id: "a", status: "WAITING" })];
      server.use(
        http.get(`${API}/queue`, () =>
          HttpResponse.json({ success: true, data: rows })
        ),
        http.patch(`${API}/queue/:id/status`, async ({ params, request }) => {
          expect(params.id).toBe("a");
          const body = (await request.json()) as { status: string };
          rows = rows.map((e) =>
            e.id === params.id
              ? { ...e, status: body.status as QueueEntry["status"] }
              : e
          );
          return HttpResponse.json({
            success: true,
            data: rows[0],
          });
        })
      );

      const { result } = renderHook(
        () => ({
          list: useQueue({ branchId: "b1" }),
          mut: useUpdateQueueStatus(),
        }),
        { wrapper: withClient(qc) }
      );

      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

      await act(async () => {
        await result.current.mut.mutateAsync({ id: "a", status: "CALLED" });
      });

      await waitFor(() => {
        expect(result.current.list.data?.data?.[0].status).toBe("CALLED");
      });
    });

    it("rolls back optimistic update on error", async () => {
      const rows: QueueEntry[] = [baseEntry({ id: "x", status: "WAITING" })];
      server.use(
        http.get(`${API}/queue`, () =>
          HttpResponse.json({ success: true, data: rows })
        ),
        http.patch(`${API}/queue/:id/status`, () =>
          HttpResponse.json({ success: false, message: "nope" }, { status: 400 })
        )
      );

      const { result: list } = renderHook(
        () => useQueue({ branchId: "b1" }),
        { wrapper: withClient(qc) }
      );
      await waitFor(() => expect(list.current.isSuccess).toBe(true));

      const key = ["queue", { branchId: "b1" }] as const;
      const before = qc.getQueryData<{ data: QueueEntry[] }>(key);

      const { result: mut } = renderHook(() => useUpdateQueueStatus(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        try {
          await mut.current.mutateAsync({ id: "x", status: "CALLED" });
        } catch {
          /* expected */
        }
      });

      await waitFor(() => {
        const after = qc.getQueryData<{ data: QueueEntry[] }>(key);
        expect(after?.data?.[0].status).toBe(before?.data?.[0].status);
      });
    });
  });

  describe("useAssignStaff", () => {
    it("invalidates queue on success", async () => {
      let listCalls = 0;
      server.use(
        http.get(`${API}/queue`, () => {
          listCalls += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.post(`${API}/queue/:id/assign`, () =>
          HttpResponse.json({ success: true, data: baseEntry() })
        )
      );

      renderHook(() => useQueue({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });
      await waitFor(() => expect(listCalls).toBe(1));

      const { result: mut } = renderHook(() => useAssignStaff(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({ id: "q1", staffProfileId: "s1" });
      });

      await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
    });
  });

  describe("useCreateEntry", () => {
    it("creates entry and invalidates queue", async () => {
      let listCalls = 0;
      server.use(
        http.get(`${API}/queue`, () => {
          listCalls += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.post(`${API}/queue`, async ({ request }) => {
          const body = (await request.json()) as { branchId: string };
          expect(body.branchId).toBe("b1");
          return HttpResponse.json({
            success: true,
            data: baseEntry({ id: "new" }),
          });
        })
      );

      renderHook(() => useQueue({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });
      await waitFor(() => expect(listCalls).toBe(1));

      const { result: mut } = renderHook(() => useCreateEntry(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({
          branchId: "b1",
          customerName: "Jane",
          serviceIds: ["svc1"],
          startTime: new Date().toISOString(),
          estimatedDuration: 20,
        });
      });

      await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
    });
  });
});
