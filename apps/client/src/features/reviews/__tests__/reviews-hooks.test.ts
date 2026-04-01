import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useReviews } from "../api/use-reviews";
import { useCreateReview } from "../api/use-create-review";
import { useUploadPhoto } from "../api/use-upload-photo";

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

const sampleReview = {
  id: "rv1",
  customerId: "c1",
  customerName: "Ann",
  staffProfileId: "st1",
  staffName: "Sam",
  branchId: "b1",
  rating: 5,
  comment: "Great",
  photoUrls: [],
  isVisible: true,
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("reviews hooks", () => {
  describe("useReviews", () => {
    it("does not fetch when enabled false", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/reviews`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: [] });
        }),
      );

      renderHook(
        () => useReviews({ enabled: false, branchId: "b1" }),
        { wrapper: qcWrapper(qc) },
      );
      expect(called).toBe(false);
    });

    it("loads reviews with query params", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/reviews`, ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("branchId")).toBe("b1");
          expect(u.searchParams.get("page")).toBe("1");
          return HttpResponse.json({
            success: true,
            data: [sampleReview],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }),
      );

      const { result } = renderHook(
        () => useReviews({ branchId: "b1", limit: 20 }),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data?.[0]?.rating).toBe(5);
    });

    it("handles reviews error", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/reviews`, () =>
          HttpResponse.json(
            { success: false, message: "Bad" },
            { status: 400 },
          ),
        ),
      );

      const { result } = renderHook(
        () => useReviews({ staffProfileId: "st1" }),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("handles fetch error with 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/reviews`, () =>
          HttpResponse.json(
            { success: false, message: "Server error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(
        () => useReviews({ branchId: "b1", limit: 20 }),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("isPending while reviews fetch is in flight", async () => {
      const qc = createQueryClient();
      server.use(
        http.get(`${API}/reviews`, async ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("branchId")).toBe("b1");
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: [sampleReview],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }),
      );

      const { result } = renderHook(
        () => useReviews({ branchId: "b1", limit: 20 }),
        { wrapper: qcWrapper(qc) },
      );

      await waitFor(() => expect(result.current.isPending).toBe(true));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useCreateReview", () => {
    it("posts review and invalidates", async () => {
      const qc = createQueryClient();
      await qc.prefetchQuery({
        queryKey: ["reviews", "b1", undefined, undefined, 1, 20],
        queryFn: () =>
          Promise.resolve({
            success: true,
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
      });

      server.use(
        http.post(`${API}/reviews`, async ({ request }) => {
          const body = (await request.json()) as { rating: number };
          expect(body.rating).toBe(4);
          return HttpResponse.json({ success: true, data: sampleReview });
        }),
      );

      const { result } = renderHook(() => useCreateReview(), {
        wrapper: qcWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          branchId: "b1",
          rating: 4,
          comment: "Nice",
        });
      });
    });

    it("surfaces mutation error", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/reviews`, () =>
          HttpResponse.json(
            { success: false, message: "Duplicate" },
            { status: 409 },
          ),
        ),
      );

      const { result } = renderHook(() => useCreateReview(), {
        wrapper: qcWrapper(qc),
      });

      await expect(
        result.current.mutateAsync({
          branchId: "b1",
          rating: 5,
        }),
      ).rejects.toThrow();
    });
  });

  describe("useUploadPhoto", () => {
    it("posts multipart and returns url", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/media/upload`, async ({ request }) => {
          expect(new URL(request.url).searchParams.get("prefix")).toBe(
            "reviews",
          );
          return HttpResponse.json({
            success: true,
            data: { url: "https://cdn.example/p.png", key: "k1" },
          });
        }),
      );

      const { result } = renderHook(() => useUploadPhoto(), {
        wrapper: qcWrapper(qc),
      });

      const file = new File(["x"], "x.png", { type: "image/png" });

      await act(async () => {
        const res = await result.current.mutateAsync(file);
        expect(res.data.url).toBe("https://cdn.example/p.png");
      });
    });
  });
});
