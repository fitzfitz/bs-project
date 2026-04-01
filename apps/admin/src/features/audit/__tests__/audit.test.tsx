import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditViewer } from "../widgets/audit-viewer";
import { useAuditLogs } from "../api/use-audit";
import { useBranchStore } from "@/store/use-branch-store";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createAuditClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderAudit() {
  const client = createAuditClient();
  return render(
    <QueryClientProvider client={client}>
      <AuditViewer />
    </QueryClientProvider>
  );
}

describe("audit feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    useBranchStore.setState({ selectedBranchId: "br-1" });
  });

  it("Audit Logs tab shows loading row while logs fetch", async () => {
    server.use(
      http.get(`${API_BASE}/audit/logs`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 30, total: 0, totalPages: 1 },
        });
      })
    );

    renderAudit();

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No audit logs found")).toBeInTheDocument();
    });
  });

  it("useAuditLogs surfaces HTTP 500 from API", async () => {
    server.use(
      http.get(`${API_BASE}/audit/logs`, () =>
        HttpResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 })
      )
    );

    const client = createAuditClient();
    const { result } = renderHook(
      () => useAuditLogs({ branchId: "br-1", page: 1, limit: 30 }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("lists audit logs with user and action", async () => {
    server.use(
      http.get(`${API_BASE}/audit/logs`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "log-1",
              userId: "u-1",
              tenantRole: { name: "Admin", scope: "HQ" },
              branchId: "br-1",
              action: "ANOMALY_FLAGGED",
              entityType: "Transaction",
              entityId: "ent-uuid-1234",
              details: { before: 1, after: 2 },
              ipAddress: "127.0.0.1",
              createdAt: "2025-06-15T10:00:00.000Z",
              user: {
                id: "u-1",
                firstName: "Jamie",
                lastName: "Admin",
                email: "j@x.com",
                tenantRole: { name: "Admin", scope: "HQ" },
              },
              branch: { id: "br-1", name: "HQ" },
            },
          ],
          pagination: { page: 1, limit: 30, total: 1, totalPages: 1 },
        })
      )
    );

    renderAudit();

    await waitFor(() => {
      expect(screen.getByText("Jamie Admin")).toBeInTheDocument();
    });
    const table = screen.getByRole("table");
    expect(within(table).getByText("ANOMALY FLAGGED")).toBeInTheDocument();
    expect(screen.getByText("Transaction")).toBeInTheDocument();
  });

  it("expands log row to show JSON details", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/audit/logs`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "log-2",
              userId: null,
              branchId: null,
              action: "ANOMALY_FLAGGED",
              entityType: "User",
              entityId: "user-uuid-9999",
              details: { foo: "bar" },
              ipAddress: null,
              createdAt: "2025-06-15T12:00:00.000Z",
              user: null,
              branch: null,
            },
          ],
          pagination: { page: 1, limit: 30, total: 1, totalPages: 1 },
        })
      )
    );

    renderAudit();

    await waitFor(() => expect(screen.getByText("System")).toBeInTheDocument());

    await user.click(within(screen.getByRole("table")).getByText("ANOMALY FLAGGED").closest("tr")!);

    await waitFor(() => {
      expect(screen.getByText(/"foo"/)).toBeInTheDocument();
    });
  });

  it("Anomalies tab resolves via PATCH", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/audit/logs`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 30, total: 0, totalPages: 1 },
        })
      ),
      http.get(`${API_BASE}/audit/anomalies/stats`, () =>
        HttpResponse.json({
          success: true,
          data: {
            total: 2,
            unresolved: 1,
            bySeverity: [
              { severity: "CRITICAL", count: 1 },
              { severity: "HIGH", count: 0 },
            ],
            byType: [],
          },
        })
      ),
      http.get(`${API_BASE}/audit/anomalies`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "anom-1",
              branchId: "br-1",
              userId: null,
              type: "LARGE_DISCOUNT",
              severity: "HIGH",
              details: { amount: 999 },
              isResolved: false,
              resolvedBy: null,
              resolvedAt: null,
              createdAt: "2025-06-15T08:00:00.000Z",
              branch: { id: "br-1", name: "HQ" },
              user: null,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      ),
      http.patch(`${API_BASE}/audit/anomalies/:id/resolve`, async ({ params, request }) => {
        expect(params.id).toBe("anom-1");
        const body = await request.json();
        expect(body).toMatchObject({ notes: "ok" });
        return HttpResponse.json({
          success: true,
          data: {
            id: "anom-1",
            branchId: "br-1",
            userId: null,
            type: "LARGE_DISCOUNT",
            severity: "HIGH",
            details: { amount: 999 },
            isResolved: true,
            resolvedBy: "u-9",
            resolvedAt: "2025-06-16T00:00:00.000Z",
            createdAt: "2025-06-15T08:00:00.000Z",
            branch: { id: "br-1", name: "HQ" },
            user: null,
          },
        });
      })
    );

    renderAudit();

    await user.click(screen.getByRole("button", { name: "Anomalies" }));

    await waitFor(() => {
      expect(screen.getByText(/LARGE DISCOUNT/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Resolve" }));

    const modal = await screen.findByRole("heading", { name: "Resolve Anomaly" });
    const modalRoot = modal.closest(".rounded-xl") as HTMLElement;

    await user.type(within(modalRoot).getByPlaceholderText(/Resolution notes/), "ok");
    await user.click(within(modalRoot).getByRole("button", { name: /Mark Resolved/i }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Resolve Anomaly" })).not.toBeInTheDocument();
    });
  });
});
