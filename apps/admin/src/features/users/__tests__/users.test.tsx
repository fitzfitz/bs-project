import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserManagement } from "../widgets/user-management";
import { useUsers } from "../api/use-users";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

const userRow = {
  id: "u-1",
  email: "a@example.com",
  firstName: "Pat",
  lastName: "Lee",
  phone: null,
  tenantRoleId: "role-1",
  tenantRole: { name: "Manager", scope: "BRANCH" },
  isActive: true,
  isCustomer: false,
  branchId: "br-1",
  branch: { id: "br-1", name: "HQ" },
  createdAt: "2025-01-01T00:00:00.000Z",
  staffProfile: null,
};

function createUsersClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderUsers() {
  const client = createUsersClient();
  return render(
    <QueryClientProvider client={client}>
      <UserManagement />
    </QueryClientProvider>
  );
}

describe("users feature", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it("shows loading row while users fetch", async () => {
    server.use(
      http.get(`${API_BASE}/users`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({
          success: true,
          data: [userRow],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      })
    );

    renderUsers();

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Pat Lee")).toBeInTheDocument();
    });
  });

  it("useUsers surfaces HTTP 500", async () => {
    server.use(
      http.get(`${API_BASE}/users`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const client = createUsersClient();
    const { result } = renderHook(() => useUsers({ page: 1, limit: 20 }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("renders user table from GET /users", async () => {
    server.use(
      http.get(`${API_BASE}/users`, () =>
        HttpResponse.json({
          success: true,
          data: [userRow],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      )
    );

    renderUsers();

    const table = await screen.findByRole("table");

    await waitFor(() => {
      expect(within(table).getByText("Pat Lee")).toBeInTheDocument();
    });
    expect(within(table).getByText("a@example.com")).toBeInTheDocument();
    expect(within(table).getByText("Manager")).toBeInTheDocument();
  });

  it("opens role dialog and PATCHes role on update", async () => {
    const user = userEvent.setup();
    let patched: { id: string; tenantRoleId: string } | null = null;

    server.use(
      http.get(`${API_BASE}/users`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              ...userRow,
              tenantRoleId: "role-a",
              tenantRole: { name: "Manager", scope: "BRANCH" },
            },
            {
              ...userRow,
              id: "u-2",
              email: "b@example.com",
              firstName: "Sam",
              lastName: "Kim",
              tenantRoleId: "role-b",
              tenantRole: { name: "Barber", scope: "BRANCH" },
            },
          ],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        })
      ),
      http.patch(`${API_BASE}/users/:id/role`, async ({ params, request }) => {
        const body = (await request.json()) as { tenantRoleId: string };
        patched = { id: params.id as string, tenantRoleId: body.tenantRoleId };
        return HttpResponse.json({ success: true, data: { ...userRow, tenantRoleId: body.tenantRoleId } });
      })
    );

    renderUsers();

    await waitFor(() => expect(screen.getByText("Pat Lee")).toBeInTheDocument());

    const roleButtons = screen.getAllByTitle("Change role");
    await user.click(roleButtons[0]);

    await waitFor(() => expect(screen.getByText("Change Role")).toBeInTheDocument());

    const dialogSelect = screen.getAllByRole("combobox").find((el) => el.closest(".fixed"));
    expect(dialogSelect).toBeTruthy();
    await user.selectOptions(dialogSelect!, "role-b");

    await user.click(screen.getByRole("button", { name: /Update Role/i }));

    await waitFor(() => {
      expect(patched).toEqual({ id: "u-1", tenantRoleId: "role-b" });
    });
  });

  it("assign branch uses POST /users/:id/assign-branch", async () => {
    const user = userEvent.setup();
    let posted: { id: string; branchId: string } | null = null;

    server.use(
      http.get(`${API_BASE}/users`, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...userRow, branch: null, branchId: null }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      ),
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: "br-new", name: "West" },
            { id: "br-1", name: "HQ" },
          ],
        })
      ),
      http.post(`${API_BASE}/users/:id/assign-branch`, async ({ params, request }) => {
        const body = (await request.json()) as { branchId: string };
        posted = { id: params.id as string, branchId: body.branchId };
        return HttpResponse.json({ success: true, data: {} });
      })
    );

    renderUsers();

    await waitFor(() => expect(screen.getByText("Pat Lee")).toBeInTheDocument());

    await user.click(screen.getByTitle("Assign branch"));

    await waitFor(() => expect(screen.getByText("Assign Branch")).toBeInTheDocument());

    const dialogSelect = screen.getAllByRole("combobox").find((el) => el.closest(".fixed"));
    await user.selectOptions(dialogSelect!, "br-new");

    await user.click(screen.getByRole("button", { name: /^Assign$/ }));

    await waitFor(() => {
      expect(posted).toEqual({ id: "u-1", branchId: "br-new" });
    });
  });

  it("shows empty state when no users match", async () => {
    server.use(
      http.get(`${API_BASE}/users`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        })
      )
    );

    renderUsers();

    await waitFor(() => {
      expect(screen.getByText("No users found")).toBeInTheDocument();
    });
  });
});
