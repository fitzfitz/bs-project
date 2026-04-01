import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { RetentionManagement } from "../widgets/retention-management";

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

describe("RetentionManagement", () => {
  it("renders stats cards with data", async () => {
    server.use(
      http.get(`${API}/retention/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalNudges: 85, last30Days: 12 },
        }),
      ),
    );

    render(<RetentionManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("85")).toBeInTheDocument();
    });
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders trigger policy information", async () => {
    server.use(
      http.get(`${API}/retention/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalNudges: 0, last30Days: 0 },
        }),
      ),
    );

    render(<RetentionManagement />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("At-risk window: 30-60 days inactive"),
      ).toBeInTheDocument();
    });
  });

  it("renders trigger button", async () => {
    server.use(
      http.get(`${API}/retention/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalNudges: 0, last30Days: 0 },
        }),
      ),
    );

    render(<RetentionManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Run Retention Triggers")).toBeInTheDocument();
    });
  });

  it("shows confirmation dialog on trigger click", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/retention/stats`, () =>
        HttpResponse.json({
          success: true,
          data: { totalNudges: 0, last30Days: 0 },
        }),
      ),
    );

    render(<RetentionManagement />, { wrapper });

    const btn = await screen.findByText("Run Retention Triggers");
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Confirm Trigger")).toBeInTheDocument();
    });
  });
});
