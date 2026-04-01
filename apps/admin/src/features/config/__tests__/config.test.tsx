import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import type { ApiResponse } from "@/lib/api";
import { useConfig, useUpdateConfig, type ConfigMap } from "../api/use-config";
import { ConfigPanel } from "../widgets/config-panel";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createClient() {
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

describe("config feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe("useConfig", () => {
    it("loads config map from GET /config", async () => {
      const qc = createClient();
      server.use(
        http.get(`${API_BASE}/config`, () =>
          HttpResponse.json({
            success: true,
            data: {
              POINTS_EARN_RATE: { value: "1000", updatedBy: "usr-1", updatedAt: "2025-01-01T00:00:00.000Z" },
              TAX_RATE: { value: "12", updatedBy: null, updatedAt: "2025-01-01T00:00:00.000Z" },
            },
          })
        )
      );

      const { result } = renderHook(() => useConfig(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const data = result.current.data as ApiResponse<ConfigMap>;
      expect(data.data.POINTS_EARN_RATE.value).toBe("1000");
      expect(data.data.TAX_RATE.value).toBe("12");
    });

    it("surfaces error when config request fails", async () => {
      const qc = createClient();
      server.use(
        http.get(`${API_BASE}/config`, () =>
          HttpResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
        )
      );

      const { result } = renderHook(() => useConfig(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("surfaces error when config returns HTTP 500", async () => {
      const qc = createClient();
      server.use(
        http.get(`${API_BASE}/config`, () =>
          HttpResponse.json(
            { success: false, message: "Internal Server Error" },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(() => useConfig(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("is loading while config request is in flight", async () => {
      const qc = createClient();
      server.use(
        http.get(`${API_BASE}/config`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({
            success: true,
            data: {
              TAX_RATE: {
                value: "10",
                updatedBy: null,
                updatedAt: "2025-01-01T00:00:00.000Z",
              },
            },
          });
        })
      );

      const { result } = renderHook(() => useConfig(), {
        wrapper: qcWrapper(qc),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useUpdateConfig", () => {
    it("PATCHes config key with new value", async () => {
      const qc = createClient();
      let patched: { key: string; value: string } | null = null;

      server.use(
        http.patch(`${API_BASE}/config/:key`, async ({ params, request }) => {
          const body = (await request.json()) as { value: string };
          patched = { key: params.key as string, value: body.value };
          return HttpResponse.json({ success: true, data: {} });
        })
      );

      const { result } = renderHook(() => useUpdateConfig(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({ key: "POINTS_EARN_RATE", value: "1200" });
      });

      expect(patched).toEqual({ key: "POINTS_EARN_RATE", value: "1200" });
    });

    it("surfaces mutation error on failure", async () => {
      const qc = createClient();

      server.use(
        http.patch(`${API_BASE}/config/:key`, () =>
          HttpResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
        )
      );

      const { result } = renderHook(() => useUpdateConfig(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ key: "TAX_RATE", value: "999" });
        } catch {
          // expected
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("invalidates config query on success", async () => {
      const qc = createClient();
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE}/config`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: { TAX_RATE: { value: "12", updatedBy: null, updatedAt: "2025-01-01T00:00:00.000Z" } },
          });
        }),
        http.patch(`${API_BASE}/config/:key`, () =>
          HttpResponse.json({ success: true, data: {} })
        )
      );

      const { result: configResult } = renderHook(() => useConfig(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(configResult.current.isSuccess).toBe(true));
      const fetchesBefore = fetchCount;

      const { result: updateResult } = renderHook(() => useUpdateConfig(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await updateResult.current.mutateAsync({ key: "TAX_RATE", value: "15" });
      });

      await waitFor(() => expect(fetchCount).toBeGreaterThan(fetchesBefore));
    });
  });

  describe("ConfigPanel", () => {
    it("renders Customer Self-Service section", async () => {
      const qc = createClient();
      server.use(
        http.get(`${API_BASE}/config`, () =>
          HttpResponse.json({ success: true, data: {} }),
        ),
      );

      render(
        <QueryClientProvider client={qc}>
          <ConfigPanel />
        </QueryClientProvider>,
      );

      await waitFor(() =>
        expect(screen.getByText("Customer Self-Service")).toBeInTheDocument(),
      );
      expect(screen.getByText("PREPAYMENT_ENABLED")).toBeInTheDocument();
    });
  });
});
