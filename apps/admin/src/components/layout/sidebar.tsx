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
import { useSessionStore, hasAnyPermission } from "@/features/auth/store";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  feature?: string;
}

const staffNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/queue",
    label: "Queue",
    icon: ListOrdered,
    feature: "QUEUE_MANAGEMENT",
  },
  { to: "/pos", label: "POS", icon: Monitor, feature: "TRANSACTION" },
  {
    to: "/transactions",
    label: "Transactions",
    icon: Receipt,
    feature: "TRANSACTION",
  },
  {
    to: "/cash-drawer",
    label: "Cash Drawer",
    icon: DollarSign,
    feature: "CASH_DRAWER",
  },
  {
    to: "/barbers",
    label: "Barbers",
    icon: Scissors,
    feature: "STAFF_MANAGEMENT",
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarClock,
    feature: "ATTENDANCE",
  },
  {
    to: "/commissions",
    label: "Commissions",
    icon: Coins,
    feature: "COMMISSION",
  },
  { to: "/payroll", label: "Payroll", icon: Wallet, feature: "PAYROLL" },
  { to: "/inventory", label: "Inventory", icon: Package, feature: "INVENTORY" },
  { to: "/reviews", label: "Reviews", icon: MessageSquare, feature: "REVIEWS" },
  { to: "/loyalty", label: "Loyalty", icon: Award, feature: "LOYALTY" },
  {
    to: "/branches",
    label: "Branch Settings",
    icon: Building2,
    feature: "BRANCH_MANAGEMENT",
  },
];

const adminNav: NavItem[] = [
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    feature: "ANALYTICS",
  },
  { to: "/reports", label: "Reports", icon: FileText, feature: "REPORTS" },
  {
    to: "/users",
    label: "User Management",
    icon: Users,
    feature: "USER_MANAGEMENT",
  },
  { to: "/audit", label: "Audit Log", icon: ScrollText, feature: "AUDIT_LOG" },
  {
    to: "/finance",
    label: "Finance",
    icon: PieChart,
    feature: "FINANCE_REPORTS",
  },
  { to: "/config", label: "Settings", icon: Settings, feature: "ORG_SETTINGS" },
];

const barberNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-schedule", label: "My Schedule", icon: Calendar },
  { to: "/my-commissions", label: "My Commissions", icon: Banknote },
  { to: "/my-attendance", label: "My Attendance", icon: Clock },
];

function NavSection({
  items,
  label,
  collapsed,
}: {
  items: NavItem[];
  label?: string;
  collapsed?: boolean;
}) {
  const location = useLocation();
  return (
    <>
      {label && !collapsed && (
        <div className="mt-5 mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400/80">
          {label}
        </div>
      )}
      {label && collapsed && (
        <div className="mx-3 mt-4 mb-2 border-t border-slate-100" />
      )}
      {items.map(({ to, label: itemLabel, icon: Icon }) => {
        const isActive = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            title={collapsed ? itemLabel : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            {isActive && !collapsed && (
              <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-500"
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
  const user = useSessionStore((s) => s.user);
  const isBarber = !!user?.staffProfile;
  const permissions = user?.permissions;

  const filteredStaffNav = staffNav.filter(
    (item) => !item.feature || hasAnyPermission(permissions, item.feature)
  );

  const filteredAdminNav = adminNav.filter(
    (item) => !item.feature || hasAnyPermission(permissions, item.feature)
  );

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-slate-200/80 bg-white flex flex-col transition-all duration-200 ease-in-out",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      <div className={cn(
        "flex h-[56px] shrink-0 items-center border-b border-slate-200/80 px-4",
        collapsed ? "justify-center" : ""
      )}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
            <span className="text-sm font-black text-white">B</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-bold text-slate-800 tracking-tight">Barbershop</span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-primary/60">Admin</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-2.5 overflow-y-auto flex-1 scrollbar-thin">
        {isBarber ? (
          <NavSection items={barberNav} collapsed={collapsed} />
        ) : (
          <>
            <NavSection items={filteredStaffNav} collapsed={collapsed} />
            {filteredAdminNav.length > 0 && (
              <NavSection
                items={filteredAdminNav}
                label="Administration"
                collapsed={collapsed}
              />
            )}
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-lg bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">Logged in as</p>
            <p className="text-xs font-semibold text-slate-700 truncate">{user?.firstName} {user?.lastName}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
