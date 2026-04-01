import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryManager } from "../widgets/inventory-manager";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("inventory feature", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("shows loading while inventory fetch is in flight", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/inventory/branches/b1`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No inventory items found/i)).toBeInTheDocument();
    });
  });

  it("shows error when inventory returns HTTP 500", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/inventory/branches/b1`, () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no rows", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/inventory/branches/b1`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No inventory items found/i)).toBeInTheDocument();
    });
  });

  it("shows low stock badge when quantity at threshold", async () => {
    const client = createClient();
    server.use(
      http.get(`${API}/inventory/branches/b1`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "inv1",
              productId: "p1",
              quantity: 2,
              reorderThreshold: 5,
              product: { name: "Pomade", sku: "POM-1" },
            },
          ],
        })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Pomade")).toBeInTheDocument());
    expect(screen.getByText("Low Stock")).toBeInTheDocument();
  });

  it("submits stock in from dialog", async () => {
    const user = userEvent.setup();
    const client = createClient();
    let posted: unknown = null;

    server.use(
      http.get(`${API}/inventory/branches/b1`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "inv1",
              productId: "p1",
              quantity: 10,
              reorderThreshold: 2,
              product: { name: "Oil", sku: "O-1" },
            },
          ],
        })
      ),
      http.post(`${API}/inventory/stock-in`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ success: true, data: {} });
      })
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Oil")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "+In" }));

    const spinners = screen.getAllByRole("spinbutton");
    await user.clear(spinners[0]);
    await user.type(spinners[0], "5");
    await user.clear(spinners[1]);
    await user.type(spinners[1], "1000");

    await user.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(posted).toMatchObject({
        branchId: "b1",
        productId: "p1",
        quantity: 5,
        costPerUnit: 1000,
      });
    });
  });

  it("disables adjust confirm without note", async () => {
    const user = userEvent.setup();
    const client = createClient();

    server.use(
      http.get(`${API}/inventory/branches/b1`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: "inv1",
              productId: "p1",
              quantity: 10,
              reorderThreshold: 2,
              product: { name: "Oil", sku: "O-1" },
            },
          ],
        })
      )
    );

    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="b1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Oil")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Adjust" }));

    const [qtyInput] = screen.getAllByRole("spinbutton");
    await user.clear(qtyInput);
    await user.type(qtyInput, "8");

    const confirm = screen.getByRole("button", { name: /Confirm/i });
    expect(confirm).toBeDisabled();
  });

  it("shows message when branchId missing", () => {
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <InventoryManager branchId="" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/No branch selected/i)).toBeInTheDocument();
  });
});
