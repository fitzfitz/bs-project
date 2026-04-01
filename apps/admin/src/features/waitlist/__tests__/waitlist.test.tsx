import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { server } from "../../../test/server";
import { useAdminWaitlist } from "../api/use-admin-waitlist";
import { WaitlistManagement } from "../widgets/waitlist-management";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

const MOCK_ENTRIES = [
  {
    id: "w1",
    organizationId: "org1",
    branchId: "b1",
    userId: "u1",
    customerName: "John Doe",
    preferredDate: "2026-04-01",
    preferredTimeSlot: "10:00-11:00",
    serviceIds: ["s1"],
    staffProfileId: null,
    status: "WAITING",
    notifiedAt: null,
    expiresAt: "2026-04-02T00:00:00.000Z",
    createdAt: "2026-03-28T10:00:00.000Z",
    user: { id: "u1", email: "john@example.com", firstName: "John", lastName: "Doe" },
  },
  {
    id: "w2",
    organizationId: "org1",
    branchId: "b1",
    userId: "u2",
    customerName: "Jane Smith",
    preferredDate: "2026-04-01",
    preferredTimeSlot: "14:00-15:00",
    serviceIds: ["s2"],
    staffProfileId: "sp1",
    status: "NOTIFIED",
    notifiedAt: "2026-03-28T12:00:00.000Z",
    expiresAt: "2026-04-02T00:00:00.000Z",
    createdAt: "2026-03-28T09:00:00.000Z",
    user: { id: "u2", email: "jane@example.com", firstName: "Jane", lastName: "Smith" },
  },
];

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

describe("waitlist feature", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe("useAdminWaitlist hook", () => {
    it("fetches waitlist entries for a branch", async () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          HttpResponse.json({ success: true, data: MOCK_ENTRIES }),
        ),
      );

      const { result } = renderHook(() => useAdminWaitlist("b1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(2);
      expect(result.current.data?.data[0].customerName).toBe("John Doe");
    });

    it("is disabled when branchId is empty", () => {
      const { result } = renderHook(() => useAdminWaitlist(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("WaitlistManagement widget", () => {
    it("shows select-branch message when branchId is empty", () => {
      render(<WaitlistManagement branchId="" />, { wrapper: createWrapper() });

      expect(screen.getByText("Select a branch to view waitlist entries.")).toBeInTheDocument();
    });

    it("shows loading skeleton while fetching", () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          new Promise(() => {}),
        ),
      );

      render(<WaitlistManagement branchId="b1" />, { wrapper: createWrapper() });

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows empty state when no entries", async () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          HttpResponse.json({ success: true, data: [] }),
        ),
      );

      render(<WaitlistManagement branchId="b1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("No waitlist entries for this branch.")).toBeInTheDocument();
      });
    });

    it("renders data table with entries", async () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          HttpResponse.json({ success: true, data: MOCK_ENTRIES }),
        ),
      );

      render(<WaitlistManagement branchId="b1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      expect(screen.getByText("10:00-11:00")).toBeInTheDocument();
      expect(screen.getByText("14:00-15:00")).toBeInTheDocument();
    });

    it("displays total entries count", async () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          HttpResponse.json({ success: true, data: MOCK_ENTRIES }),
        ),
      );

      render(<WaitlistManagement branchId="b1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("2 entries")).toBeInTheDocument();
      });
    });

    it("renders table headers", async () => {
      server.use(
        http.get(`${API_BASE}/waitlist/admin`, () =>
          HttpResponse.json({ success: true, data: MOCK_ENTRIES }),
        ),
      );

      render(<WaitlistManagement branchId="b1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      expect(screen.getByText("Customer")).toBeInTheDocument();
      expect(screen.getByText("Preferred Date")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });
});
