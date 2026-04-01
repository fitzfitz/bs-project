import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { LoyaltyDashboard } from "../widgets/loyalty-dashboard";
import { useSessionStore } from "@/features/auth/store";

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const membership = {
  id: "m1",
  userId: "u1",
  pointsBalance: 50,
  lifetimePoints: 250,
  tier: "SILVER" as const,
  tierMultiplier: 1.25,
  pointsExpiringAt: null,
  lastActivityAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("LoyaltyDashboard", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-session-storage");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it("shows error UI when account request fails", async () => {
    const qc = createQueryClient();
    useSessionStore.getState().setSession(
      {
        id: "u1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        tenantRoleId: "tr1",
      },
      "t",
      "r",
    );

    server.use(
      http.get(`${API}/loyalty/me`, () =>
        HttpResponse.json(
          { success: false, message: "fail" },
          { status: 500 },
        ),
      ),
      http.get(`${API}/loyalty/me/history`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
      http.get(`${API}/referrals/me/code`, () =>
        HttpResponse.json({ success: true, data: { referralCode: "X" } }),
      ),
      http.get(`${API}/referrals/me/history`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );

    render(
      <QueryClientProvider client={qc}>
        <LoyaltyDashboard />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/could not load loyalty info/i)).toBeInTheDocument(),
    );
  });

  it("renders loyalty card when account loads", async () => {
    const qc = createQueryClient();
    useSessionStore.getState().setSession(
      {
        id: "u1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        tenantRoleId: "tr1",
      },
      "t",
      "r",
    );

    server.use(
      http.get(`${API}/loyalty/me`, () =>
        HttpResponse.json({ success: true, data: membership }),
      ),
      http.get(`${API}/loyalty/me/history`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }),
      ),
      http.get(`${API}/referrals/me/code`, () =>
        HttpResponse.json({ success: true, data: { referralCode: "REF1" } }),
      ),
      http.get(`${API}/referrals/me/history`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );

    render(
      <QueryClientProvider client={qc}>
        <LoyaltyDashboard />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("SILVER")).toBeInTheDocument(),
    );
    expect(screen.getByText(/points history/i)).toBeInTheDocument();
  });
});
