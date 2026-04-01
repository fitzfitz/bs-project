import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useNotificationList,
  useUnreadCount,
} from "../api/use-notifications";

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

describe("notifications feature", () => {
  describe("useNotificationList", () => {
    it("fetches paginated notifications", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/notifications`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "n1",
                title: "Booking Confirmed",
                body: "Your booking is confirmed!",
                type: "BOOKING_CONFIRMED",
                data: null,
                read: false,
                createdAt: "2026-03-23T10:00:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        ),
      );

      const { result } = renderHook(() => useNotificationList(1), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data[0].title).toBe("Booking Confirmed");
      expect(result.current.data?.pagination?.total).toBe(1);
    });

    it("handles error state", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/notifications`, () =>
          HttpResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 },
          ),
        ),
      );

      const { result } = renderHook(() => useNotificationList(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUnreadCount", () => {
    it("fetches unread count", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/notifications/unread-count`, () =>
          HttpResponse.json({
            success: true,
            data: { count: 5 },
          }),
        ),
      );

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.count).toBe(5);
    });

    it("returns 0 when no unread", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/notifications/unread-count`, () =>
          HttpResponse.json({
            success: true,
            data: { count: 0 },
          }),
        ),
      );

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.count).toBe(0);
    });

    it("handles error state", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/notifications/unread-count`, () =>
          HttpResponse.json(
            { success: false, message: "Error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
