import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Package, Inbox } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataCardGrid } from "@/components/ui/data-card-grid";

describe("StatCard", () => {
  it("renders value and label", () => {
    render(<StatCard label="Revenue" value="Rp 5.000.000" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Rp 5.000.000")).toBeInTheDocument();
  });

  it("renders with icon", () => {
    render(<StatCard label="Products" value={42} icon={Package} />);
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders with upward trend", () => {
    render(
      <StatCard
        label="Sales"
        value={120}
        trend={{ value: 12, direction: "up" }}
      />,
    );
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    const trendEl = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && !!el?.textContent?.includes("12%"),
    );
    expect(trendEl.className).toMatch(/text-success/);
  });

  it("renders with downward trend", () => {
    render(
      <StatCard
        label="Returns"
        value={5}
        trend={{ value: 3, direction: "down" }}
      />,
    );
    const trendEl = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && !!el?.textContent?.includes("3%"),
    );
    expect(trendEl.className).toMatch(/text-destructive/);
  });

  it("shows skeleton when loading", () => {
    const { container } = render(<StatCard label="Revenue" value="" loading />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No transactions found" />);
    expect(screen.getByText("No transactions found")).toBeInTheDocument();
  });

  it("renders with icon and description", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No data"
        description="Try adjusting your filters"
      />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders with action button", () => {
    render(
      <EmptyState
        title="Empty"
        action={<button>Create New</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create New" })).toBeInTheDocument();
  });

  it("renders without optional props", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders with default variant", () => {
    render(<StatusBadge variant="default">Draft</StatusBadge>);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders success variant", () => {
    const { container } = render(
      <StatusBadge variant="success">Completed</StatusBadge>,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/success/);
  });

  it("renders warning variant", () => {
    const { container } = render(
      <StatusBadge variant="warning">Pending</StatusBadge>,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/warning/);
  });

  it("renders error variant", () => {
    const { container } = render(
      <StatusBadge variant="error">Failed</StatusBadge>,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/destructive/);
  });

  it("renders info variant", () => {
    const { container } = render(
      <StatusBadge variant="info">In Progress</StatusBadge>,
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/info/);
  });
});

describe("DataCardGrid", () => {
  it("renders children in a grid", () => {
    render(
      <DataCardGrid>
        <div>Card 1</div>
        <div>Card 2</div>
      </DataCardGrid>,
    );
    expect(screen.getByText("Card 1")).toBeInTheDocument();
    expect(screen.getByText("Card 2")).toBeInTheDocument();
  });

  it("applies 4-column grid by default", () => {
    const { container } = render(
      <DataCardGrid>
        <div>A</div>
      </DataCardGrid>,
    );
    expect(container.firstElementChild?.className).toMatch(/lg:grid-cols-4/);
  });

  it("applies 2-column grid when specified", () => {
    const { container } = render(
      <DataCardGrid columns={2}>
        <div>A</div>
      </DataCardGrid>,
    );
    expect(container.firstElementChild?.className).toMatch(/lg:grid-cols-2/);
  });

  it("applies 3-column grid when specified", () => {
    const { container } = render(
      <DataCardGrid columns={3}>
        <div>A</div>
      </DataCardGrid>,
    );
    expect(container.firstElementChild?.className).toMatch(/lg:grid-cols-3/);
  });
});
