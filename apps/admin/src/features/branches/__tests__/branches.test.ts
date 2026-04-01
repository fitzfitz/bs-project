import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useBranch,
  useUpdateBranch,
  useBranchHolidays,
  useCreateHoliday,
} from "../api/use-branch-settings";

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

const branchPayload = {
  id: "b1",
  name: "Main",
  address: "Jl. 1",
  city: "Jakarta",
  phone: null,
  email: null,
  latitude: null,
  longitude: null,
  imageUrl: null,
  isActive: true,
  isEmergencyClosed: false,
};

describe("branches feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    qc = createQueryClient();
  });

  describe("useBranch", () => {
    it("disabled when id empty", () => {
      let hit = false;
      server.use(
        http.get(`${API}/branches/:id`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: branchPayload });
        })
      );

      renderHook(() => useBranch(""), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });

    it("loads branch detail", async () => {
      server.use(
        http.get(`${API}/branches/b1`, () =>
          HttpResponse.json({ success: true, data: branchPayload })
        )
      );

      const { result } = renderHook(() => useBranch("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data.name).toBe("Main");
    });

    it("is loading while branch detail is in flight", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`${API}/branches/b1`, async () => {
          await gate;
          return HttpResponse.json({ success: true, data: branchPayload });
        })
      );

      const { result } = renderHook(() => useBranch("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(true));
      expect(result.current.isPending).toBe(true);
      expect(result.current.isLoading).toBe(true);
      release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("surfaces error when branch detail returns 500", async () => {
      server.use(
        http.get(`${API}/branches/b1`, () =>
          HttpResponse.json({ message: "Branch load failed" }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useBranch("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toBe("Branch load failed");
    });
  });

  describe("useUpdateBranch", () => {
    it("invalidates branch and branches queries", async () => {
      let branchFetches = 0;
      server.use(
        http.get(`${API}/branches/b1`, () => {
          branchFetches += 1;
          return HttpResponse.json({ success: true, data: branchPayload });
        }),
        http.patch(`${API}/branches/:id`, async ({ params, request }) => {
          expect(params.id).toBe("b1");
          const body = (await request.json()) as { name: string };
          expect(body.name).toBe("Renamed");
          return HttpResponse.json({
            success: true,
            data: { ...branchPayload, name: body.name },
          });
        })
      );

      renderHook(() => useBranch("b1"), { wrapper: withClient(qc) });
      await waitFor(() => expect(branchFetches).toBe(1));

      const { result: mut } = renderHook(() => useUpdateBranch(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({ id: "b1", name: "Renamed" });
      });

      await waitFor(() => expect(branchFetches).toBeGreaterThanOrEqual(2));
    });
  });

  describe("holidays", () => {
    it("useBranchHolidays fetches list", async () => {
      server.use(
        http.get(`${API}/branches/b1/holidays`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "h1",
                branchId: "b1",
                date: "2025-12-25",
                name: "Xmas",
                isClosed: true,
                openTime: null,
                closeTime: null,
              },
            ],
          })
        )
      );

      const { result } = renderHook(() => useBranchHolidays("b1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
    });

    it("useCreateHoliday invalidates holidays query", async () => {
      let holidayFetches = 0;
      server.use(
        http.get(`${API}/branches/b1/holidays`, () => {
          holidayFetches += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.post(`${API}/branches/:branchId/holidays`, () =>
          HttpResponse.json({
            success: true,
            data: {
              id: "h2",
              branchId: "b1",
              date: "2025-01-01",
              name: "NY",
              isClosed: true,
              openTime: null,
              closeTime: null,
            },
          })
        )
      );

      renderHook(() => useBranchHolidays("b1"), { wrapper: withClient(qc) });
      await waitFor(() => expect(holidayFetches).toBe(1));

      const { result: mut } = renderHook(() => useCreateHoliday(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({
          branchId: "b1",
          date: "2025-01-01",
          name: "NY",
        });
      });

      await waitFor(() => expect(holidayFetches).toBeGreaterThanOrEqual(2));
    });
  });
});
