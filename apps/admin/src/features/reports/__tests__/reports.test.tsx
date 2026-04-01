import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportGenerator } from "../widgets/report-generator";
import { ReportSchedules } from "../widgets/report-schedules";
import { ReportTemplates } from "../widgets/report-templates";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderGenerator() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <ReportGenerator branchId="br-1" dateFrom="2025-01-01" dateTo="2025-01-31" />
    </QueryClientProvider>
  );
}

function renderSchedules() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <ReportSchedules />
    </QueryClientProvider>
  );
}

function renderTemplates() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <ReportTemplates />
    </QueryClientProvider>
  );
}

describe("reports feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("loads report table when generate returns columns and rows", async () => {
    server.use(
      http.get(`${API_BASE}/reports/generate`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("branchId")).toBe("br-1");
        expect(url.searchParams.get("type")).toBe("daily_revenue");
        return HttpResponse.json({
          success: true,
          data: {
            type: "daily_revenue",
            columns: ["day", "amount"],
            rows: [{ day: "2025-01-01", amount: 100 }],
            generatedAt: "2025-01-31T00:00:00.000Z",
          },
        });
      })
    );

    renderGenerator();

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "day" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Rp\s*100/)).toBeInTheDocument();
  });

  it("shows empty row message when rows array empty", async () => {
    server.use(
      http.get(`${API_BASE}/reports/generate`, () =>
        HttpResponse.json({
          success: true,
          data: {
            type: "daily_revenue",
            columns: ["x"],
            rows: [],
            generatedAt: "2025-01-31T00:00:00.000Z",
          },
        })
      )
    );

    renderGenerator();

    await waitFor(() => {
      expect(screen.getByText("No data for this period")).toBeInTheDocument();
    });
  });

  it("export CSV triggers fetch and download side effect on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    server.use(
      http.get(`${API_BASE}/reports/generate`, () =>
        HttpResponse.json({
          success: true,
          data: {
            type: "daily_revenue",
            columns: ["a"],
            rows: [{ a: 1 }],
            generatedAt: "2025-01-31T00:00:00.000Z",
          },
        })
      ),
      http.get(`${API_BASE}/reports/export/csv`, () => new HttpResponse("a,b\n1,2", { status: 200 }))
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderGenerator();

    await waitFor(() => expect(screen.getByText("Export CSV")).not.toBeDisabled());

    await user.click(screen.getByText("Export CSV"));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });

  it("export PDF triggers fetch and download side effect on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-pdf");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
    server.use(
      http.get(`${API_BASE}/reports/generate`, () =>
        HttpResponse.json({
          success: true,
          data: {
            type: "daily_revenue",
            columns: ["a"],
            rows: [{ a: 1 }],
            generatedAt: "2025-01-31T00:00:00.000Z",
          },
        })
      ),
      http.get(`${API_BASE}/reports/export/pdf`, () => new HttpResponse(pdfBytes, { status: 200 }))
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderGenerator();

    await waitFor(() => expect(screen.getByRole("button", { name: /Export PDF/i })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /Export PDF/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:mock-pdf");

    clickSpy.mockRestore();
  });

  it("changes report type refetches with new type param", async () => {
    const user = userEvent.setup();
    const types: string[] = [];

    server.use(
      http.get(`${API_BASE}/reports/generate`, ({ request }) => {
        const url = new URL(request.url);
        types.push(url.searchParams.get("type") ?? "");
        return HttpResponse.json({
          success: true,
          data: {
            type: url.searchParams.get("type"),
            columns: ["c"],
            rows: [{ c: 1 }],
            generatedAt: "2025-01-31T00:00:00.000Z",
          },
        });
      })
    );

    renderGenerator();

    await waitFor(() => expect(types[types.length - 1]).toBe("daily_revenue"));

    await user.selectOptions(screen.getByRole("combobox"), "staff_leaderboard");

    await waitFor(() => {
      expect(types).toContain("staff_leaderboard");
    });
  });

  it("schedules tab shows empty state when API returns no schedules", async () => {
    server.use(
      http.get(`${API_BASE}/reports/schedules`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.get(`${API_BASE}/branches`, () => HttpResponse.json({ success: true, data: [] }))
    );

    renderSchedules();

    await waitFor(() => {
      expect(screen.getByText("No scheduled reports")).toBeInTheDocument();
    });
  });

  it("templates list shows empty state when API returns no templates", async () => {
    server.use(
      http.get(`${API_BASE}/reports/templates`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    renderTemplates();

    await waitFor(() => {
      expect(screen.getByText("No saved templates")).toBeInTheDocument();
    });
  });
});
