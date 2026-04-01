import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { usePaymentMethods } from "../api/use-payment-methods";

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

describe("payments feature", () => {
  describe("usePaymentMethods", () => {
    it("fetches saved payment methods", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/payments/methods`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "pm-1",
                type: "CARD",
                last4: "4242",
                expiryMonth: 12,
                expiryYear: 2028,
                isDefault: true,
                createdAt: "2026-03-23T10:00:00.000Z",
              },
            ],
          }),
        ),
      );

      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].last4).toBe("4242");
    });

    it("returns empty array when no methods", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/payments/methods`, () =>
          HttpResponse.json({ success: true, data: [] }),
        ),
      );

      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it("handles error state", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/payments/methods`, () =>
          HttpResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 },
          ),
        ),
      );

      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
