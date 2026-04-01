import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useReviews, useModerateReview, useDeleteReview } from "../api/use-reviews";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("reviews feature hooks", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("useReviews is disabled without branchId", () => {
    let hit = false;
    server.use(
      http.get(`${API_BASE}/reviews`, () => {
        hit = true;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        });
      })
    );

    const { result } = renderHook(
      () => useReviews({ branchId: undefined, page: 1, limit: 20 }),
      { wrapper: createWrapper() }
    );

    expect(hit).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
  });

  it("useReviews is disabled when branchId is empty string", () => {
    let hit = false;
    server.use(
      http.get(`${API_BASE}/reviews`, () => {
        hit = true;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        });
      })
    );

    const { result } = renderHook(
      () => useReviews({ branchId: "", page: 1, limit: 20 }),
      { wrapper: createWrapper() }
    );

    expect(hit).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
  });

  it("useReviews requests includeHidden and pagination query params", async () => {
    let captured = "";
    server.use(
      http.get(`${API_BASE}/reviews`, ({ request }) => {
        captured = request.url;
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: "r1",
              customerId: "c1",
              customerName: "A B",
              staffProfileId: null,
              staffName: null,
              branchId: "br-1",
              rating: 5,
              comment: "Great",
              photoUrls: [],
              isVisible: true,
              createdAt: "2025-01-01T00:00:00.000Z",
            },
          ],
          pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        });
      })
    );

    const { result } = renderHook(
      () => useReviews({ branchId: "br-1", page: 2, limit: 10 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = new URL(captured);
    expect(url.searchParams.get("includeHidden")).toBe("true");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("branchId")).toBe("br-1");
    expect(result.current.data?.data).toHaveLength(1);
  });

  it("useReviews surfaces error when list returns 500", async () => {
    server.use(
      http.get(`${API_BASE}/reviews`, () =>
        HttpResponse.json({ message: "Reviews failed" }, { status: 500 })
      )
    );

    const { result } = renderHook(
      () => useReviews({ branchId: "br-1", page: 1, limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Reviews failed");
  });

  it("useModerateReview PATCHes visibility", async () => {
    const hit = vi.fn();
    server.use(
      http.patch(`${API_BASE}/reviews/:id/moderate`, async ({ params, request }) => {
        hit(params.id);
        const body = await request.json();
        expect(body).toMatchObject({ isVisible: false });
        return HttpResponse.json({
          success: true,
          message: "Review hidden",
        });
      })
    );

    const { result } = renderHook(() => useModerateReview(), { wrapper: createWrapper() });

    result.current.mutate({ id: "rev-1", isVisible: false, moderationNote: "spam" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toHaveBeenCalledWith("rev-1");
  });

  it("useDeleteReview DELETEs review", async () => {
    const hit = vi.fn();
    server.use(
      http.delete(`${API_BASE}/reviews/:id`, ({ params }) => {
        hit(params.id);
        return HttpResponse.json({ success: true, data: {} });
      })
    );

    const { result } = renderHook(() => useDeleteReview(), { wrapper: createWrapper() });

    result.current.mutate("rev-9");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hit).toHaveBeenCalledWith("rev-9");
  });
});
