import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useCurrentSession,
  useOpenSession,
  useCloseSession,
  useAddEntry,
} from "../api/use-cash-drawer";

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

const openSession = {
  id: "sess1",
  branchId: "b1",
  openedById: "u1",
  openingBalance: 100,
  closingBalance: null,
  expectedBalance: null,
  discrepancy: null,
  status: "OPEN" as const,
  openedAt: new Date().toISOString(),
  closedAt: null,
  notes: null,
};

describe("cash-drawer feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    qc = createQueryClient();
  });

  describe("useCurrentSession", () => {
    it("disabled without branchId", () => {
      let hit = false;
      server.use(
        http.get(`${API}/cash-drawer/current`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: null });
        })
      );

      renderHook(() => useCurrentSession(null), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });

    it("loads current session for branch", async () => {
      server.use(
        http.get(`${API}/cash-drawer/current`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
          return HttpResponse.json({ success: true, data: openSession });
        })
      );

      const { result } = renderHook(() => useCurrentSession("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.status).toBe("OPEN");
    });

    it("is loading while current session is in flight", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`${API}/cash-drawer/current`, async ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
          await gate;
          return HttpResponse.json({ success: true, data: openSession });
        })
      );

      const { result } = renderHook(() => useCurrentSession("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(true));
      expect(result.current.isPending).toBe(true);
      expect(result.current.isLoading).toBe(true);
      release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("surfaces error when current session returns 500", async () => {
      server.use(
        http.get(`${API}/cash-drawer/current`, () =>
          HttpResponse.json({ message: "Drawer unavailable" }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useCurrentSession("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toBe("Drawer unavailable");
    });
  });

  describe("useOpenSession", () => {
    it("invalidates current session for branch", async () => {
      let currentCalls = 0;
      server.use(
        http.get(`${API}/cash-drawer/current`, () => {
          currentCalls += 1;
          return HttpResponse.json({ success: true, data: null });
        }),
        http.post(`${API}/cash-drawer/open`, async ({ request }) => {
          const body = (await request.json()) as { branchId: string };
          expect(body.branchId).toBe("b1");
          return HttpResponse.json({ success: true, data: openSession });
        })
      );

      renderHook(() => useCurrentSession("b1"), { wrapper: withClient(qc) });
      await waitFor(() => expect(currentCalls).toBe(1));

      const { result: mut } = renderHook(() => useOpenSession(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({ branchId: "b1", openingBalance: 50 });
      });

      await waitFor(() => expect(currentCalls).toBeGreaterThanOrEqual(2));
    });
  });

  describe("useCloseSession", () => {
    it("invalidates when response includes branchId", async () => {
      let currentCalls = 0;
      const closed = { ...openSession, status: "CLOSED" as const, closingBalance: 200 };
      server.use(
        http.get(`${API}/cash-drawer/current`, () => {
          currentCalls += 1;
          return HttpResponse.json({ success: true, data: openSession });
        }),
        http.post(`${API}/cash-drawer/close`, () =>
          HttpResponse.json({ success: true, data: closed })
        )
      );

      renderHook(() => useCurrentSession("b1"), { wrapper: withClient(qc) });
      await waitFor(() => expect(currentCalls).toBe(1));

      const { result: mut } = renderHook(() => useCloseSession(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({
          sessionId: "sess1",
          closingBalance: 200,
        });
      });

      await waitFor(() => expect(currentCalls).toBeGreaterThanOrEqual(2));
    });
  });

  describe("useAddEntry", () => {
    it("invalidates cash-drawer queries", async () => {
      let currentCalls = 0;
      server.use(
        http.get(`${API}/cash-drawer/current`, () => {
          currentCalls += 1;
          return HttpResponse.json({ success: true, data: openSession });
        }),
        http.post(`${API}/cash-drawer/entry`, () =>
          HttpResponse.json({
            success: true,
            data: {
              id: "e1",
              sessionId: "sess1",
              type: "SALE",
              amount: 50,
              reference: null,
              createdAt: new Date().toISOString(),
            },
          })
        )
      );

      renderHook(() => useCurrentSession("b1"), { wrapper: withClient(qc) });
      await waitFor(() => expect(currentCalls).toBe(1));

      const { result: mut } = renderHook(() => useAddEntry(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({
          sessionId: "sess1",
          type: "SALE",
          amount: 50,
        });
      });

      await waitFor(() => expect(currentCalls).toBeGreaterThanOrEqual(2));
    });
  });
});
