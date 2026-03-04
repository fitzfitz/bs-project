import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Receipt,
  Scissors,
  CalendarClock,
  Coins,
  Wallet,
  Package,
  Building2,
  DollarSign,
  Calendar,
  Banknote,
  Clock,
  MessageSquare,
  Award,
  BarChart3,
  FileText,
  Users,
  ScrollText,
  PieChart,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useSessionStore } from "@/features/auth/store";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const fullNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/queue", label: "Queue", icon: ListOrdered },
  { to: "/pos", label: "POS", icon: Monitor },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/cash-drawer", label: "Cash Drawer", icon: DollarSign },
  { to: "/barbers", label: "Barbers", icon: Scissors },
  { to: "/attendance", label: "Attendance", icon: CalendarClock },
  { to: "/commissions", label: "Commissions", icon: Coins },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/loyalty", label: "Loyalty", icon: Award },
  { to: "/branches", label: "Branch Settings", icon: Building2 },
];

const superAdminNav: NavItem[] = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/finance", label: "Finance", icon: PieChart },
  { to: "/config", label: "Settings", icon: Settings },
];

const barberNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-schedule", label: "My Schedule", icon: Calendar },
  { to: "/my-commissions", label: "My Commissions", icon: Banknote },
  { to: "/my-attendance", label: "My Attendance", icon: Clock },
];

function NavSection({ items, label, collapsed }: { items: NavItem[]; label?: string; collapsed?: boolean }) {
  const location = useLocation();
  return (
    <>
      {label && !collapsed && (
        <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
      )}
      {label && collapsed && <div className="mt-3 mb-1 border-t border-slate-200" />}
      {items.map(({ to, label: itemLabel, icon: Icon }) => {
        const isActive = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            title={collapsed ? itemLabel : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                isActive ? "text-primary" : "text-slate-400"
              )}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            {!collapsed && <span>{itemLabel}</span>}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const tenantRole = useSessionStore((s) => s.user?.tenantRole);
  const isSuperAdmin = tenantRole?.scope === "HQ";
  const isBarber = !!useSessionStore((s) => s.user?.staffProfile);

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-slate-200 bg-white flex flex-col transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-56"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4">
        <span
          className={cn(
            "font-bold text-primary transition-opacity",
            collapsed ? "text-center w-full text-lg" : "text-lg"
          )}
        >
          {collapsed ? "B" : "Barber Admin"}
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
        {isBarber ? (
          <NavSection items={barberNav} collapsed={collapsed} />
        ) : (
          <>
            <NavSection items={fullNav} collapsed={collapsed} />
            {isSuperAdmin && (
              <NavSection items={superAdminNav} label="Super Admin" collapsed={collapsed} />
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
