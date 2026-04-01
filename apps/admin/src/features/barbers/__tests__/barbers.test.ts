import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useBarbers,
  useBarber,
  useCreateBarber,
  useDeleteBarber,
} from "../api/use-barbers";
import { useUserSearch } from "../api/use-user-search";

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

const staffRow = {
  id: "st1",
  userId: "u1",
  bio: null,
  tier: "JUNIOR" as const,
  status: "AVAILABLE" as const,
  specialties: [],
  commissionModel: "PERCENT",
  commissionRate: 10,
  baseSalary: 0,
  user: {
    id: "u1",
    firstName: "Joe",
    lastName: "Cut",
    email: "j@example.com",
    isActive: true,
    avatar: null,
  },
  branch: { id: "b1", name: "Main" },
};

describe("barbers feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    qc = createQueryClient();
  });

  describe("useBarbers", () => {
    it("lists staff from /staff", async () => {
      server.use(
        http.get(`${API}/staff`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
          return HttpResponse.json({ success: true, data: [staffRow] });
        })
      );

      const { result } = renderHook(() => useBarbers({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data?.[0].user.firstName).toBe("Joe");
    });

    it("surfaces error when staff list returns 500", async () => {
      server.use(
        http.get(`${API}/staff`, () =>
          HttpResponse.json({ message: "Staff list failed" }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useBarbers({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toBe("Staff list failed");
    });
  });

  describe("useBarber", () => {
    it("does not fetch when id is null", () => {
      let hit = false;
      server.use(
        http.get(`${API}/staff/:id`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: staffRow });
        })
      );

      renderHook(() => useBarber(null), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });

    it("does not fetch when id is empty string", () => {
      let hit = false;
      server.use(
        http.get(`${API}/staff/:id`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: staffRow });
        })
      );

      renderHook(() => useBarber(""), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });

    it("fetches detail when id set", async () => {
      server.use(
        http.get(`${API}/staff/st1`, () =>
          HttpResponse.json({ success: true, data: staffRow })
        )
      );

      const { result } = renderHook(() => useBarber("st1"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data.id).toBe("st1");
    });
  });

  describe("useCreateBarber", () => {
    it("invalidates barbers list on success", async () => {
      let listCalls = 0;
      server.use(
        http.get(`${API}/staff`, () => {
          listCalls += 1;
          return HttpResponse.json({ success: true, data: [] });
        }),
        http.post(`${API}/staff`, () =>
          HttpResponse.json({ success: true, data: staffRow })
        )
      );

      renderHook(() => useBarbers({ branchId: "b1" }), {
        wrapper: withClient(qc),
      });
      await waitFor(() => expect(listCalls).toBe(1));

      const { result: mut } = renderHook(() => useCreateBarber(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync({ userId: "u1" });
      });

      await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
    });
  });

  describe("useDeleteBarber", () => {
    it("invalidates barbers on success", async () => {
      let listCalls = 0;
      server.use(
        http.get(`${API}/staff`, () => {
          listCalls += 1;
          return HttpResponse.json({ success: true, data: [staffRow] });
        }),
        http.delete(`${API}/staff/:id`, () =>
          HttpResponse.json({ success: true, data: {} })
        )
      );

      renderHook(() => useBarbers({}), { wrapper: withClient(qc) });
      await waitFor(() => expect(listCalls).toBe(1));

      const { result: mut } = renderHook(() => useDeleteBarber(), {
        wrapper: withClient(qc),
      });

      await act(async () => {
        await mut.current.mutateAsync("st1");
      });

      await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
    });
  });

  describe("useUserSearch", () => {
    it("does not search for short terms", () => {
      let hit = false;
      server.use(
        http.get(`${API}/auth/users`, () => {
          hit = true;
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      renderHook(() => useUserSearch("a"), { wrapper: withClient(qc) });
      expect(hit).toBe(false);
    });

    it("searches when term has 2+ chars after debounce", async () => {
      let hit = false;
      server.use(
        http.get(`${API}/auth/users`, ({ request }) => {
          hit = true;
          const q = new URL(request.url).searchParams.get("search");
          expect(q).toBe("ab");
          expect(
            new URL(request.url).searchParams.get("excludeBarbers")
          ).toBe("true");
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: "u9",
                email: "x@y.com",
                firstName: "A",
                lastName: "B",
                tenantRoleId: "tr",
              },
            ],
          });
        })
      );

      const { result } = renderHook(() => useUserSearch("ab"), {
        wrapper: withClient(qc),
      });

      await waitFor(() => expect(hit).toBe(true), { timeout: 3000 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
