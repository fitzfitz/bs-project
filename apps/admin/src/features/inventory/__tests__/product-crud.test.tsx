import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, type ReactNode } from "react";
import { ProductManager } from "../widgets/product-manager";
import { useCreateProduct, useUpdateProduct, useDeleteProduct } from "../api/use-product-crud";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => createClient(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const sampleProduct = {
  id: "p1",
  name: "Pomade",
  sku: "POM-1",
  description: null as string | null,
  costPrice: 50000,
  sellPrice: 85000,
  imageUrl: null as string | null,
  isActive: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

function listJson(data: unknown[]) {
  return {
    success: true as const,
    data,
    pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 },
  };
}

describe("product CRUD hooks", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("useCreateProduct posts payload", async () => {
    const client = createClient();
    let posted: unknown = null;
    server.use(
      http.post(`${API}/inventory/products`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ success: true, data: { ...sampleProduct, id: "new" } }, { status: 201 });
      })
    );

    const { result } = renderHook(() => useCreateProduct(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    await result.current.mutateAsync({
      name: "Oil",
      sku: "O-99",
      costPrice: 10,
      sellPrice: 20,
      isActive: true,
    });

    expect(posted).toMatchObject({ name: "Oil", sku: "O-99", costPrice: 10, sellPrice: 20 });
  });

  it("useUpdateProduct patches by id", async () => {
    const client = createClient();
    let patched: unknown = null;
    server.use(
      http.patch(`${API}/inventory/products/p1`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ success: true, data: sampleProduct });
      })
    );

    const { result } = renderHook(() => useUpdateProduct(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    await result.current.mutateAsync({ id: "p1", name: "Renamed" });
    expect(patched).toMatchObject({ name: "Renamed" });
  });

  it("useDeleteProduct deletes by id", async () => {
    const client = createClient();
    let deleted = false;
    server.use(
      http.delete(`${API}/inventory/products/p1`, () => {
        deleted = true;
        return HttpResponse.json({ success: true, data: sampleProduct });
      })
    );

    const { result } = renderHook(() => useDeleteProduct(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    await result.current.mutateAsync("p1");
    expect(deleted).toBe(true);
  });
});

describe("ProductManager widget", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("shows loading then rows", async () => {
    server.use(
      http.get(`${API}/inventory/products`, async () => {
        await new Promise((r) => setTimeout(r, 60));
        return HttpResponse.json(listJson([sampleProduct]));
      })
    );

    render(
      <Providers>
        <ProductManager />
      </Providers>
    );

    expect(screen.getByText(/Loading products/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Pomade")).toBeInTheDocument());
    expect(screen.getByText("POM-1")).toBeInTheDocument();
  });

  it("shows list error message", async () => {
    server.use(
      http.get(`${API}/inventory/products`, () =>
        HttpResponse.json({ success: false, message: "Inventory down" }, { status: 500 })
      )
    );

    render(
      <Providers>
        <ProductManager />
      </Providers>
    );

    await waitFor(() => expect(screen.getByText(/Inventory down/i)).toBeInTheDocument());
  });

  it("submits create product from dialog", async () => {
    const user = userEvent.setup();
    let posted: unknown = null;

    server.use(
      http.get(`${API}/inventory/products`, () => HttpResponse.json(listJson([]))),
      http.post(`${API}/inventory/products`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { success: true, data: { ...sampleProduct, id: "new", name: "Oil", sku: "O-1" } },
          { status: 201 }
        );
      })
    );

    render(
      <Providers>
        <ProductManager />
      </Providers>
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /Create product/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Create product/i }));

    await user.type(screen.getByLabelText(/Name/i), "Oil");
    await user.type(screen.getByLabelText(/^SKU$/i), "O-1");

    const spinners = screen.getAllByRole("spinbutton");
    await user.clear(spinners[0]);
    await user.type(spinners[0], "1000");
    await user.clear(spinners[1]);
    await user.type(spinners[1], "2500");

    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      expect(posted).toMatchObject({
        name: "Oil",
        sku: "O-1",
        costPrice: 1000,
        sellPrice: 2500,
        isActive: true,
      });
    });
  });

  it("opens delete confirmation and calls DELETE", async () => {
    const user = userEvent.setup();
    let deleted = false;

    server.use(
      http.get(`${API}/inventory/products`, () => HttpResponse.json(listJson([sampleProduct]))),
      http.delete(`${API}/inventory/products/p1`, () => {
        deleted = true;
        return HttpResponse.json({ success: true, data: sampleProduct });
      })
    );

    render(
      <Providers>
        <ProductManager />
      </Providers>
    );

    await waitFor(() => expect(screen.getByText("Pomade")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Delete Pomade/i }));

    expect(screen.getByRole("heading", { name: /Delete product/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => expect(deleted).toBe(true));
  });
});
