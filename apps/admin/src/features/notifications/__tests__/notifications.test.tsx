import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { NotificationManagement } from "../widgets/notification-management";

const API = "http://localhost:8787/api";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("NotificationManagement", () => {
  it("renders stats cards and notification table", async () => {
    server.use(
      http.get(`${API}/notifications/admin/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalSent: 120, totalUnread: 15, last30Days: 45, byType: [] },
        }),
      ),
      http.get(`${API}/notifications/admin`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "n1",
              userId: "u1",
              title: "Booking Confirmed",
              body: "Your booking is confirmed",
              type: "BOOKING_CONFIRMED",
              data: null,
              read: false,
              createdAt: new Date().toISOString(),
              user: { id: "u1", firstName: "John", lastName: "Doe", email: "j@d.com" },
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      ),
    );

    render(<NotificationManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("120")).toBeInTheDocument();
    });
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Booking Confirmed")).toBeInTheDocument();
    });
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders empty state when no notifications", async () => {
    server.use(
      http.get(`${API}/notifications/admin/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalSent: 0, totalUnread: 0, last30Days: 0, byType: [] },
        }),
      ),
      http.get(`${API}/notifications/admin`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    );

    render(<NotificationManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No notifications found")).toBeInTheDocument();
    });
  });

  it("renders test send button", async () => {
    server.use(
      http.get(`${API}/notifications/admin/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalSent: 0, totalUnread: 0, last30Days: 0, byType: [] },
        }),
      ),
      http.get(`${API}/notifications/admin`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    );

    render(<NotificationManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Test Send")).toBeInTheDocument();
    });
  });
});
