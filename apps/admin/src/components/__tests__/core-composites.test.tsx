import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { PageContainer } from "@/components/ui/page-container";
import { QueryState } from "@/components/ui/query-state";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
  });

  it("renders with description", () => {
    render(<PageHeader title="Queue" description="Manage your queue" />);
    expect(screen.getByText("Manage your queue")).toBeInTheDocument();
  });

  it("renders actions slot on the right", () => {
    render(
      <PageHeader title="Inventory" actions={<button>Add Item</button>} />,
    );
    expect(screen.getByRole("button", { name: "Add Item" })).toBeInTheDocument();
  });

  it("renders badge next to title", () => {
    render(
      <PageHeader title="Transactions" badge={<span data-testid="badge">12</span>} />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("12");
  });

  it("applies correct typography classes to the title", () => {
    render(<PageHeader title="Test" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toMatch(/text-2xl/);
    expect(heading.className).toMatch(/font-semibold/);
    expect(heading.className).toMatch(/tracking-tight/);
  });
});

describe("PageContainer", () => {
  it("renders children", () => {
    render(
      <PageContainer>
        <p>Page content</p>
      </PageContainer>,
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("applies space-y-6 for page-level spacing", () => {
    const { container } = render(
      <PageContainer>
        <div>A</div>
        <div>B</div>
      </PageContainer>,
    );
    expect(container.firstElementChild?.className).toMatch(/space-y-6/);
  });

  it("accepts custom className", () => {
    const { container } = render(
      <PageContainer className="max-w-4xl">
        <div>Content</div>
      </PageContainer>,
    );
    expect(container.firstElementChild?.className).toMatch(/max-w-4xl/);
  });
});

describe("QueryState", () => {
  function SuccessQuery({ data }: { data: string[] }) {
    const query = useQuery({
      queryKey: ["test-success"],
      queryFn: () => Promise.resolve(data),
    });
    return (
      <QueryState query={query}>
        {(items) => (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </QueryState>
    );
  }

  function ErrorQuery() {
    const query = useQuery({
      queryKey: ["test-error"],
      queryFn: () => Promise.reject(new Error("Network failure")),
    });
    return (
      <QueryState query={query}>
        {(data) => <div>{String(data)}</div>}
      </QueryState>
    );
  }

  function EmptyQuery() {
    const query = useQuery({
      queryKey: ["test-empty"],
      queryFn: () => Promise.resolve([]),
    });
    return (
      <QueryState
        query={query}
        empty={<div>No results found</div>}
      >
        {(items: unknown[]) => <div>{items.length} items</div>}
      </QueryState>
    );
  }

  function EmptyWithPredicateQuery() {
    const query = useQuery({
      queryKey: ["test-empty-pred"],
      queryFn: () => Promise.resolve({ items: [], total: 0 }),
    });
    return (
      <QueryState
        query={query}
        empty={(data: { items: unknown[]; total: number }) => data.items.length === 0}
      >
        {(data: { items: unknown[]; total: number }) => <div>{data.total} total</div>}
      </QueryState>
    );
  }

  it("renders children with data on success", async () => {
    render(
      <Wrapper>
        <SuccessQuery data={["Apple", "Banana"]} />
      </Wrapper>,
    );
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("renders error fallback on error", async () => {
    render(
      <Wrapper>
        <ErrorQuery />
      </Wrapper>,
    );
    expect(await screen.findByText(/network failure/i)).toBeInTheDocument();
  });

  it("renders empty state when data is empty array and empty prop is ReactNode", async () => {
    render(
      <Wrapper>
        <EmptyQuery />
      </Wrapper>,
    );
    expect(await screen.findByText("No results found")).toBeInTheDocument();
  });

  it("renders empty state when empty predicate returns true", async () => {
    render(
      <Wrapper>
        <EmptyWithPredicateQuery />
      </Wrapper>,
    );
    expect(await screen.findByText("No data available")).toBeInTheDocument();
  });

  it("renders custom loading fallback", () => {
    function LoadingQuery() {
      const query = useQuery({
        queryKey: ["test-loading-custom"],
        queryFn: () => new Promise(() => {}),
      });
      return (
        <QueryState
          query={query}
          loadingFallback={<div>Custom loading...</div>}
        >
          {() => <div>Data</div>}
        </QueryState>
      );
    }
    render(
      <Wrapper>
        <LoadingQuery />
      </Wrapper>,
    );
    expect(screen.getByText("Custom loading...")).toBeInTheDocument();
  });

  it("shows default loading skeleton when no custom fallback", () => {
    function DefaultLoadingQuery() {
      const query = useQuery({
        queryKey: ["test-loading-default"],
        queryFn: () => new Promise(() => {}),
      });
      return (
        <QueryState query={query}>
          {() => <div>Data</div>}
        </QueryState>
      );
    }
    const { container } = render(
      <Wrapper>
        <DefaultLoadingQuery />
      </Wrapper>,
    );
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
