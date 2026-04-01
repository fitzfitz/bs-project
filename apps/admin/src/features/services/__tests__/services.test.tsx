import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useServices } from "../api/use-services";
import { ServiceManager } from "../widgets/service-manager";
import ServicesPage from "@/pages/services/page";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

const sampleService = {
  id: "svc-1",
  organizationId: "org-1",
  name: "Classic Cut",
  description: null,
  category: "Hair",
  type: "STANDARD" as const,
  basePrice: 85000,
  durationMinutes: 30,
  bufferMinutes: 5,
  isCommissionable: true,
  loyaltyEligible: true,
  isActive: true,
  sortOrder: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  tierSurcharges: [] as { id: string; serviceId: string; organizationId: string; tier: string; surcharge: number }[],
  comboChildren: [] as {
    id: string;
    comboId: string;
    childServiceId: string;
    organizationId: string;
    childService: {
      id: string;
      name: string;
      category: string;
      type: "STANDARD" | "COMBO" | "ADD_ON";
      basePrice: number;
    };
  }[],
  branchOverrides: [] as {
    id: string;
    branchId: string;
    serviceId: string;
    organizationId: string;
    overridePrice: number | null;
    isActive: boolean;
  }[],
};

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function withClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("services feature", () => {
  let qc: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    qc = createClient();
  });

  it("useServices loads list", async () => {
    server.use(
      http.get(`${API_BASE}/services`, () =>
        HttpResponse.json({
          success: true,
          data: [sampleService],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        })
      )
    );

    const { result } = renderHook(() => useServices({ page: 1, limit: 50 }), {
      wrapper: withClient(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data?.[0].name).toBe("Classic Cut");
  });

  it("useServices surfaces HTTP errors", async () => {
    server.use(
      http.get(`${API_BASE}/services`, () =>
        HttpResponse.json({ success: false, message: "Server error" }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useServices(), {
      wrapper: withClient(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("ServiceManager renders table with service row", async () => {
    server.use(
      http.get(`${API_BASE}/services`, () =>
        HttpResponse.json({
          success: true,
          data: [sampleService],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        })
      ),
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json({ success: true, data: [{ id: "b1", name: "HQ" }] })
      )
    );

    render(
      <QueryClientProvider client={qc}>
        <ServiceManager />
      </QueryClientProvider>
    );

    const table = await screen.findByRole("table");
    expect(table).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Classic Cut")).toBeInTheDocument();
    });
  });

  it("ServicesPage renders heading and manager", async () => {
    server.use(
      http.get(`${API_BASE}/services`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })
      ),
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    render(
      <QueryClientProvider client={qc}>
        <ServicesPage />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", { name: /Service Catalog/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No services match your filters/i)).toBeInTheDocument();
    });
  });
});
