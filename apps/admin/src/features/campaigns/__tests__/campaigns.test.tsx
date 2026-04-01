import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { server } from "../../../test/server";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useSendCampaign,
} from "../api/use-campaigns";
import CampaignsPage from "@/pages/campaigns/page";

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

describe("campaigns feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("exports campaign hooks", () => {
    expect(useCampaigns).toBeDefined();
    expect(useCreateCampaign).toBeDefined();
    expect(useUpdateCampaign).toBeDefined();
    expect(useDeleteCampaign).toBeDefined();
    expect(useSendCampaign).toBeDefined();
  });

  it("useCampaigns fetches list", async () => {
    server.use(
      http.get(`${API_BASE}/campaigns`, ({ request }) => {
        const u = new URL(request.url);
        expect(u.searchParams.get("page")).toBe("1");
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: "c1",
              branchId: "b1",
              name: "Test",
              description: null,
              type: "EMAIL",
              promoCodeId: null,
              segmentId: null,
              status: "DRAFT",
              startsAt: "2026-01-01T00:00:00.000Z",
              endsAt: null,
              sentCount: 0,
              openCount: 0,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      })
    );

    const { result } = renderHook(
      () => useCampaigns({ branchId: "b1", page: 1, limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].name).toBe("Test");
  });

  it("renders campaigns page with heading", async () => {
    server.use(
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.get(`${API_BASE}/campaigns`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        })
      )
    );

    render(<CampaignsPage />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: /campaigns/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/no campaigns yet/i)).toBeInTheDocument();
    });
  });
});
