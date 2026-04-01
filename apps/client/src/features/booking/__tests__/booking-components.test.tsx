import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceSelection from "../components/service-selection";
import BarberSelection from "../components/barber-selection";
import TimeSelection from "../components/time-selection";
import BookingConfirm from "../components/booking-confirm";
import { useBookingStore } from "../store";
import { useSessionStore } from "@/features/auth/store";

vi.mock("@/features/reviews/widgets/review-feed", () => ({
  ReviewFeed: () => <div data-testid="review-feed-stub" />,
}));

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function servicesHandler() {
  return http.get(`${API}/services`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: "svc-1",
          name: "Haircut",
          description: "Standard",
          category: "Cut",
          type: "SERVICE",
          basePrice: 80000,
          durationMinutes: 30,
          bufferMinutes: 0,
          isCommissionable: false,
          loyaltyEligible: true,
          isActive: true,
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
    }),
  );
}

describe("booking components", () => {
  beforeEach(() => {
    useBookingStore.getState().resetBooking();
    localStorage.removeItem("tmng-session-storage");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it("ServiceSelection shows loading then services and toggles selection", async () => {
    server.use(servicesHandler());
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1"]}>
          <Routes>
            <Route path="/book/:branchId" element={<ServiceSelection />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/loading services/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("Haircut")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /haircut/i }));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it("ServiceSelection Continue navigates to barber step", async () => {
    server.use(servicesHandler());
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1"]}>
          <Routes>
            <Route path="/book/:branchId" element={<ServiceSelection />} />
            <Route
              path="/book/:branchId/barber"
              element={<div>Barber step</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Haircut")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /haircut/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByText("Barber step")).toBeInTheDocument(),
    );
  });

  it("BarberSelection loads staff and navigates on Any Available", async () => {
    server.use(
      http.get(`${API}/staff`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "st1",
              tier: "JUNIOR",
              specialties: [],
              averageRating: 0,
              totalReviews: 0,
              user: { firstName: "Sam", lastName: "Lee" },
            },
          ],
        }),
      ),
    );
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/barber"]}>
          <Routes>
            <Route path="/book/:branchId/barber" element={<BarberSelection />} />
            <Route path="/book/:branchId/time" element={<div>Time step</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/any available/i)).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText(/any available/i));

    await waitFor(() =>
      expect(screen.getByText("Time step")).toBeInTheDocument(),
    );
  });

  it("TimeSelection shows empty slots message when API returns no slots", async () => {
    useBookingStore.setState({ selectedServiceIds: ["svc-1"] });
    server.use(
      http.get(`${API}/queue/availability`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/time"]}>
          <Routes>
            <Route path="/book/:branchId/time" element={<TimeSelection />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/no available slots for this date/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /join waitlist/i })).toBeInTheDocument();
  });

  it("TimeSelection join waitlist calls API when no slots", async () => {
    useBookingStore.setState({ selectedServiceIds: ["svc-1"], selectedBarberId: null });
    let posted = false;
    server.use(
      http.get(`${API}/queue/availability`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
      http.post(`${API}/waitlist`, async ({ request }) => {
        posted = true;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.branchId).toBe("b1");
        expect(body.preferredTimeSlot).toBe("ANY");
        return HttpResponse.json({ success: true, data: { id: "w1" } });
      }),
    );
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/time"]}>
          <Routes>
            <Route path="/book/:branchId/time" element={<TimeSelection />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /join waitlist/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => expect(posted).toBe(true));
    await waitFor(() =>
      expect(screen.getByText(/you've been added to the waitlist/i)).toBeInTheDocument(),
    );
  });

  it("TimeSelection enables Continue when slot selected", async () => {
    server.use(
      http.get(`${API}/queue/availability`, () =>
        HttpResponse.json({
          success: true,
          data: [{ time: "10:00", available: true }],
        }),
      ),
    );
    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/time"]}>
          <Routes>
            <Route path="/book/:branchId/time" element={<TimeSelection />} />
            <Route
              path="/book/:branchId/confirm"
              element={<div>Confirm step</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "10:00" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "10:00" }));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByText("Confirm step")).toBeInTheDocument(),
    );
  });

  it("BookingConfirm shows incomplete state when store is empty", () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/confirm"]}>
          <Routes>
            <Route path="/book/:branchId/confirm" element={<BookingConfirm />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/incomplete booking/i)).toBeInTheDocument();
  });

  it("BookingConfirm submits and navigates to history on success", async () => {
    server.use(
      servicesHandler(),
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: "u1",
            firstName: "Pat",
            lastName: "Customer",
            email: "p@c.com",
            tenantRoleId: "tr1",
          },
        }),
      ),
      http.post(`${API}/queue`, () =>
        HttpResponse.json({ success: true, data: { id: "qe1" } }),
      ),
    );

    useSessionStore.getState().setSession(
      {
        id: "u1",
        email: "p@c.com",
        firstName: "Pat",
        lastName: "Customer",
        tenantRoleId: "tr1",
        isCustomer: true,
      },
      "token",
      "refresh",
    );

    useBookingStore.setState({
      branchId: "b1",
      selectedServiceIds: ["svc-1"],
      selectedBarberId: null,
      selectedDate: new Date(2025, 2, 20),
      selectedTimeSlot: "14:00",
    });

    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/confirm"]}>
          <Routes>
            <Route path="/book/:branchId/confirm" element={<BookingConfirm />} />
            <Route path="/history" element={<div>History page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/confirm booking/i)).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /confirm & book/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("History page")).toBeInTheDocument(),
    );
    expect(useBookingStore.getState().selectedServiceIds).toEqual([]);
  });

  it("BookingConfirm shows prepayment follow-up when API returns prepaymentAvailable", async () => {
    server.use(
      servicesHandler(),
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: "u1",
            firstName: "Pat",
            lastName: "Customer",
            email: "p@c.com",
            tenantRoleId: "tr1",
          },
        }),
      ),
      http.post(`${API}/queue`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "qe1", prepaymentAvailable: true, depositAmount: 50000 },
        }),
      ),
    );

    useSessionStore.getState().setSession(
      {
        id: "u1",
        email: "p@c.com",
        firstName: "Pat",
        lastName: "Customer",
        tenantRoleId: "tr1",
        isCustomer: true,
      },
      "token",
      "refresh",
    );

    useBookingStore.setState({
      branchId: "b1",
      selectedServiceIds: ["svc-1"],
      selectedBarberId: null,
      selectedDate: new Date(2025, 2, 20),
      selectedTimeSlot: "14:00",
    });

    const qc = createQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/book/b1/confirm"]}>
          <Routes>
            <Route path="/book/:branchId/confirm" element={<BookingConfirm />} />
            <Route path="/history" element={<div>History page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/confirm booking/i)).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /confirm & book/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/online prepayment available/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/deposit:/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /continue to my appointments/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("History page")).toBeInTheDocument(),
    );
  });
});
