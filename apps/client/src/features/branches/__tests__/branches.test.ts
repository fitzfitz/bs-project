import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useBranches } from "../api/use-branches";
import { useBranch } from "../api/use-branch";

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

describe("branches feature", () => {
  describe("useBranches", () => {
    it("fetches all branches without search", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches`, ({ request }) => {
          expect(new URL(request.url).search).toBe("");
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: "b1",
                name: "Main",
                city: "Jakarta",
                address: "Jl. 1",
                latitude: null,
                longitude: null,
                imageUrl: null,
                phone: null,
                email: null,
                isActive: true,
                isEmergencyClosed: false,
                averageRating: 4.2,
                totalReviews: 10,
                organizationId: "org1",
                operatingHours: [],
                surgeRules: [],
                createdAt: "2025-01-01T00:00:00.000Z",
                updatedAt: "2025-01-01T00:00:00.000Z",
              },
            ],
          });
        }),
      );

      const { result } = renderHook(() => useBranches(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.name).toBe("Main");
    });

    it("appends city query when search provided", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches`, ({ request }) => {
          expect(new URL(request.url).searchParams.get("city")).toBe(
            "Bandung",
          );
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      const { result } = renderHook(() => useBranches("Bandung"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it("handles error state with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches`, () =>
          HttpResponse.json(
            { success: false, message: "Down" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useBranches(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while branches fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      const { result } = renderHook(() => useBranches(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useBranch", () => {
    it("disabled without id", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/branches/b1`, () => {
          called = true;
          return HttpResponse.json({
            success: true,
            data: { id: "b1", name: "X" },
          });
        }),
      );

      renderHook(() => useBranch(undefined), {
        wrapper: qcWrapper(qc),
      });
      expect(called).toBe(false);
    });

    it("fetches single branch", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches/b99`, () =>
          HttpResponse.json({
            success: true,
            data: { id: "b99", name: "HQ" },
          }),
        ),
      );

      const { result } = renderHook(() => useBranch("b99"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.name).toBe("HQ");
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches/b99`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useBranch("b99"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while branch fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/branches/b99`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: { id: "b99", name: "HQ" },
          });
        }),
      );

      const { result } = renderHook(() => useBranch("b99"), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

});
