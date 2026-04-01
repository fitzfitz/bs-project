import {
  LayoutDashboard,
  ListOrdered,
  ListRestart,
  Monitor,
  Receipt,
  DollarSign,
  Scissors,
  CalendarClock,
  Coins,
  Wallet,
  Package,
  ClipboardList,
  MessageSquare,
  Award,
  Megaphone,
  Contact,
  HeartPulse,
  BellRing,
  BarChart3,
  FileText,
  Users,
  ScrollText,
  PieChart,
  Settings,
  Building2,
  Calendar,
  Banknote,
  Clock,
  Zap,
  UserCog,
  ShoppingBag,
  Heart,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  feature?: string;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    id: "daily-ops",
    labelKey: "sidebar:dailyOperations",
    icon: Zap,
    defaultOpen: true,
    items: [
      { to: "/", labelKey: "sidebar:dashboard", icon: LayoutDashboard },
      { to: "/queue", labelKey: "sidebar:queue", icon: ListOrdered, feature: "QUEUE_MANAGEMENT" },
      { to: "/waitlist", labelKey: "sidebar:waitlist", icon: ListRestart, feature: "QUEUE_MANAGEMENT" },
      { to: "/pos", labelKey: "sidebar:pos", icon: Monitor, feature: "TRANSACTION" },
      { to: "/transactions", labelKey: "sidebar:transactions", icon: Receipt, feature: "TRANSACTION" },
      { to: "/cash-drawer", labelKey: "sidebar:cashDrawer", icon: DollarSign, feature: "CASH_DRAWER" },
    ],
  },
  {
    id: "staff-hr",
    labelKey: "sidebar:staffHr",
    icon: UserCog,
    items: [
      { to: "/barbers", labelKey: "sidebar:barbers", icon: Scissors, feature: "STAFF_MANAGEMENT" },
      { to: "/attendance", labelKey: "sidebar:attendance", icon: CalendarClock, feature: "ATTENDANCE" },
      { to: "/commissions", labelKey: "sidebar:commissions", icon: Coins, feature: "COMMISSION" },
      { to: "/payroll", labelKey: "sidebar:payroll", icon: Wallet, feature: "PAYROLL" },
    ],
  },
  {
    id: "products",
    labelKey: "sidebar:productsServices",
    icon: ShoppingBag,
    items: [
      { to: "/inventory", labelKey: "sidebar:inventory", icon: Package, feature: "INVENTORY" },
      { to: "/services", labelKey: "sidebar:services", icon: ClipboardList, feature: "SERVICE_CATALOG" },
    ],
  },
  {
    id: "engagement",
    labelKey: "sidebar:customerEngagement",
    icon: Heart,
    items: [
      { to: "/reviews", labelKey: "sidebar:reviews", icon: MessageSquare, feature: "REVIEWS" },
      { to: "/loyalty", labelKey: "sidebar:loyalty", icon: Award, feature: "LOYALTY" },
      { to: "/campaigns", labelKey: "sidebar:campaigns", icon: Megaphone, feature: "CAMPAIGNS" },
      { to: "/crm", labelKey: "sidebar:customerInsights", icon: Contact, feature: "CRM" },
      { to: "/retention", labelKey: "sidebar:retention", icon: HeartPulse, feature: "RETENTION" },
      { to: "/notifications", labelKey: "sidebar:notifications", icon: BellRing, feature: "CAMPAIGNS" },
    ],
  },
  {
    id: "admin",
    labelKey: "sidebar:administration",
    icon: Shield,
    items: [
      { to: "/analytics", labelKey: "sidebar:analytics", icon: BarChart3, feature: "ANALYTICS" },
      { to: "/reports", labelKey: "sidebar:reports", icon: FileText, feature: "REPORTS" },
      { to: "/users", labelKey: "sidebar:userManagement", icon: Users, feature: "USER_MANAGEMENT" },
      { to: "/audit", labelKey: "sidebar:auditLog", icon: ScrollText, feature: "AUDIT_LOG" },
      { to: "/finance", labelKey: "sidebar:finance", icon: PieChart, feature: "FINANCE_REPORTS" },
      { to: "/config", labelKey: "sidebar:settings", icon: Settings, feature: "ORG_SETTINGS" },
      { to: "/branches", labelKey: "sidebar:branchSettings", icon: Building2, feature: "BRANCH_MANAGEMENT" },
    ],
  },
];

export const barberNav: NavItem[] = [
  { to: "/", labelKey: "sidebar:dashboard", icon: LayoutDashboard },
  { to: "/my-schedule", labelKey: "sidebar:mySchedule", icon: Calendar },
  { to: "/my-commissions", labelKey: "sidebar:myCommissions", icon: Banknote },
  { to: "/my-attendance", labelKey: "sidebar:myAttendance", icon: Clock },
];

const routeToLabelMap = new Map<string, { labelKey: string; groupLabelKey?: string }>();
for (const group of navGroups) {
  for (const item of group.items) {
    routeToLabelMap.set(item.to, {
      labelKey: item.labelKey,
      groupLabelKey: group.labelKey,
    });
  }
}
for (const item of barberNav) {
  if (!routeToLabelMap.has(item.to)) {
    routeToLabelMap.set(item.to, { labelKey: item.labelKey });
  }
}

export function getRouteLabel(path: string): { labelKey: string; groupLabelKey?: string } | undefined {
  return routeToLabelMap.get(path);
}

export function getAllNavItems(): NavItem[] {
  return navGroups.flatMap((g) => g.items);
}

export function findGroupForRoute(path: string): NavGroup | undefined {
  return navGroups.find((g) => g.items.some((item) => item.to === path));
}
