import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { SidebarGroup } from "@/components/layout/sidebar-group";
import { Sidebar } from "@/components/layout/sidebar";
import { AppBreadcrumbs } from "@/components/layout/breadcrumbs";
import { ListOrdered, Zap } from "lucide-react";
import { useSessionStore } from "@/features/auth/store";

Element.prototype.scrollIntoView = () => {};

function Wrapper({ children, initialEntries = ["/"] }: { children: React.ReactNode; initialEntries?: string[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SidebarNavItem", () => {
  it("renders icon and label", () => {
    render(
      <Wrapper>
        <SidebarNavItem to="/queue" label="Queue" icon={ListOrdered} />
      </Wrapper>,
    );
    expect(screen.getByText("Queue")).toBeInTheDocument();
  });

  it("shows active state for matching route", () => {
    render(
      <Wrapper initialEntries={["/queue"]}>
        <SidebarNavItem to="/queue" label="Queue" icon={ListOrdered} />
      </Wrapper>,
    );
    const link = screen.getByRole("link");
    expect(link.className).toMatch(/bg-primary/);
  });

  it("shows badge count when provided", () => {
    render(
      <Wrapper>
        <SidebarNavItem to="/queue" label="Queue" icon={ListOrdered} badge={5} />
      </Wrapper>,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders link when collapsed (tooltip on hover)", () => {
    render(
      <Wrapper>
        <SidebarNavItem to="/queue" label="Queue" icon={ListOrdered} collapsed />
      </Wrapper>,
    );
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(screen.queryByText("Queue")).not.toBeInTheDocument();
  });
});

describe("SidebarGroup", () => {
  it("renders expanded by default when isOpen is true", () => {
    render(
      <Wrapper>
        <SidebarGroup
          label="Daily Operations"
          icon={Zap}
          isOpen={true}
          onToggle={() => {}}
        >
          <div>Child content</div>
        </SidebarGroup>
      </Wrapper>,
    );
    expect(screen.getByText("Daily Operations")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("calls onToggle when header is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <Wrapper>
        <SidebarGroup
          label="Staff & HR"
          icon={Zap}
          isOpen={false}
          onToggle={onToggle}
        >
          <div>Content</div>
        </SidebarGroup>
      </Wrapper>,
    );
    const trigger = screen.getByRole("button");
    await userEvent.click(trigger);
    expect(onToggle).toHaveBeenCalled();
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      user: {
        id: "u1",
        email: "admin@test.com",
        firstName: "Admin",
        lastName: "User",
        tenantRoleId: "tr1",
        tenantRole: { name: "Owner", scope: "HQ" },
        permissions: {
          QUEUE_MANAGEMENT: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          TRANSACTION: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          CASH_DRAWER: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          STAFF_MANAGEMENT: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          ATTENDANCE: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          COMMISSION: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          PAYROLL: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          INVENTORY: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          SERVICE_CATALOG: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          REVIEWS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          LOYALTY: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          CAMPAIGNS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          CRM: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          RETENTION: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          ANALYTICS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          REPORTS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          USER_MANAGEMENT: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          AUDIT_LOG: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          FINANCE_REPORTS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          ORG_SETTINGS: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
          BRANCH_MANAGEMENT: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
        },
      },
      accessToken: "token",
      refreshToken: "refresh",
    });
  });

  it("renders all groups for HQ user", () => {
    render(
      <Wrapper>
        <Sidebar />
      </Wrapper>,
    );
    expect(screen.getByText("Daily Operations")).toBeInTheDocument();
    expect(screen.getByText("Staff & HR")).toBeInTheDocument();
    expect(screen.getByText("Products & Services")).toBeInTheDocument();
    expect(screen.getByText("Customer Engagement")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();
  });

  it("renders barber portal for staff with staffProfile", () => {
    useSessionStore.setState({
      user: {
        id: "u2",
        email: "barber@test.com",
        firstName: "Barber",
        lastName: "Staff",
        tenantRoleId: "tr2",
        tenantRole: { name: "Barber", scope: "BRANCH" },
        staffProfile: { id: "sp1", tier: "SENIOR" },
        permissions: {},
      },
    });
    render(
      <Wrapper>
        <Sidebar />
      </Wrapper>,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Schedule")).toBeInTheDocument();
  });

  it("filters items by RBAC permissions", () => {
    useSessionStore.setState({
      user: {
        id: "u3",
        email: "limited@test.com",
        firstName: "Limited",
        lastName: "User",
        tenantRoleId: "tr3",
        tenantRole: { name: "Cashier", scope: "BRANCH" },
        permissions: {
          TRANSACTION: { canCreate: true, canRead: true, canUpdate: false, canDelete: false },
          CASH_DRAWER: { canCreate: true, canRead: true, canUpdate: false, canDelete: false },
        },
      },
    });
    render(
      <Wrapper>
        <Sidebar />
      </Wrapper>,
    );
    expect(screen.getByText("POS")).toBeInTheDocument();
    expect(screen.getByText("Cash Drawer")).toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
  });
});

describe("AppBreadcrumbs", () => {
  it("renders Home for root route", () => {
    render(
      <Wrapper initialEntries={["/"]}>
        <AppBreadcrumbs />
      </Wrapper>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders group + page for known nested route", () => {
    render(
      <Wrapper initialEntries={["/queue"]}>
        <AppBreadcrumbs />
      </Wrapper>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Queue")).toBeInTheDocument();
  });

  it("handles unknown routes gracefully", () => {
    render(
      <Wrapper initialEntries={["/unknown-page"]}>
        <AppBreadcrumbs />
      </Wrapper>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Unknown Page")).toBeInTheDocument();
  });
});
