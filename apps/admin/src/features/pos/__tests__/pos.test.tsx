import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { POSCheckout } from "../widgets/pos-checkout";
import { OfflineBanner } from "../components/offline-banner";
import { SyncIndicator } from "../components/sync-indicator";
import { usePOSStore } from "../store/use-pos-store";
import { useBranchStore } from "@/store/use-branch-store";
import { useSessionStore } from "@/features/auth/store";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

vi.mock("@/lib/offline-store", () => ({
  saveOfflineTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync-pending", () => ({
  syncPendingTransactions: vi.fn(),
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function setupHappyPathHandlers() {
  server.use(
    http.get(`${API}/services`, () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            id: "svc1",
            name: "Haircut",
            basePrice: 80000,
            durationMinutes: 30,
          },
        ],
      })
    ),
    http.get(`${API}/branches`, () =>
      HttpResponse.json({
        success: true,
        data: [{ id: "b1", name: "Main" }],
      })
    ),
    http.get(`${API}/config`, () =>
      HttpResponse.json({
        success: true,
        data: {
          TAX_RATE: {
            value: "10",
            updatedBy: null,
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      })
    ),
    http.get(`${API}/inventory/products`, ({ request }) => {
      expect(new URL(request.url).searchParams.get("branchId")).toBe("b1");
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: "p1",
            name: "Wax",
            sellPrice: 50000,
            isActive: true,
            inventory: [{ quantity: 3 }],
          },
        ],
      });
    })
  );
}

describe("pos feature", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-admin-branch");
    useBranchStore.setState({ selectedBranchId: null });
    usePOSStore.getState().reset();
    useSessionStore.setState({
      user: null,
      accessToken: "tok",
      refreshToken: null,
    });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  describe("POSCheckout", () => {
    it("adds a service and completes online payment", async () => {
      const user = userEvent.setup();
      const client = createClient();
      let txId = "";

      setupHappyPathHandlers();
      server.use(
        http.post(`${API}/transactions`, async ({ request }) => {
          const body = (await request.json()) as { branchId: string };
          expect(body.branchId).toBe("b1");
          txId = "tx-99";
          return HttpResponse.json({ success: true, data: { id: txId } });
        }),
        http.post(`${API}/transactions/:id/pay`, ({ params }) => {
          expect(params.id).toBe("tx-99");
          return HttpResponse.json({ success: true, data: {} });
        })
      );

      render(
        <QueryClientProvider client={client}>
          <POSCheckout />
        </QueryClientProvider>
      );

      await waitFor(() => expect(screen.getByText("Haircut")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /Haircut/i }));

      await user.click(screen.getByRole("button", { name: /Cash/i }));

      await user.click(
        screen.getByRole("button", { name: /Complete —/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/Payment Complete/i)).toBeInTheDocument();
      });
    });

    it("shows services catalog skeleton while services load", async () => {
      const client = createClient();
      server.use(
        http.get(`${API}/services`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: "svc1",
                name: "Haircut",
                basePrice: 80000,
                durationMinutes: 30,
              },
            ],
          });
        }),
        http.get(`${API}/branches`, () =>
          HttpResponse.json({
            success: true,
            data: [{ id: "b1", name: "Main" }],
          })
        ),
        http.get(`${API}/config`, () =>
          HttpResponse.json({
            success: true,
            data: {
              TAX_RATE: {
                value: "10",
                updatedBy: null,
                updatedAt: "2025-01-01T00:00:00.000Z",
              },
            },
          })
        ),
        http.get(`${API}/inventory/products`, () =>
          HttpResponse.json({ success: true, data: [] })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <POSCheckout />
        </QueryClientProvider>
      );

      const pulses = document.querySelectorAll(".animate-pulse");
      expect(pulses.length).toBeGreaterThan(0);

      await waitFor(() => expect(screen.getByText("Haircut")).toBeInTheDocument());
    });

    it("shows catalog error when services fail", async () => {
      const client = createClient();
      server.use(
        http.get(`${API}/services`, () =>
          HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
        ),
        http.get(`${API}/branches`, () =>
          HttpResponse.json({ success: true, data: [{ id: "b1", name: "Main" }] })
        ),
        http.get(`${API}/config`, () =>
          HttpResponse.json({ success: true, data: {} })
        ),
        http.get(`${API}/inventory/products`, () =>
          HttpResponse.json({ success: true, data: [] })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <POSCheckout />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/boom/i)).toBeInTheDocument();
      });
    });

    it("disables out of stock products", async () => {
      const user = userEvent.setup();
      const client = createClient();
      setupHappyPathHandlers();
      server.use(
        http.get(`${API}/inventory/products`, () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                id: "p1",
                name: "Gone",
                sellPrice: 10000,
                isActive: true,
                inventory: [{ quantity: 0 }],
              },
            ],
          })
        )
      );

      render(
        <QueryClientProvider client={client}>
          <POSCheckout />
        </QueryClientProvider>
      );

      await waitFor(() => expect(screen.getByText("Products")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /Products/i }));

      await waitFor(() => expect(screen.getByText("Gone")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /Gone/i })).toBeDisabled();
    });
  });

  describe("OfflineBanner", () => {
    it("renders when navigator reports offline", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      render(<OfflineBanner />);
      expect(
        screen.getByText(/You are offline/i)
      ).toBeInTheDocument();
    });

    it("renders nothing when online", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      const { container } = render(<OfflineBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("SyncIndicator", () => {
    it("shows offline after window offline event", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      render(<SyncIndicator />);
      window.dispatchEvent(new Event("offline"));
      await waitFor(() => {
        expect(screen.getByText("Offline")).toBeInTheDocument();
      });
    });
  });
});
