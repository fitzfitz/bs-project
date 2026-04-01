import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  collapsed?: boolean;
}

export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  badge,
  collapsed,
}: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  const link = (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      )}
    >
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive
            ? "text-primary"
            : "text-slate-400 group-hover:text-slate-500",
        )}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <span className="flex items-center gap-2">
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {badge}
              </span>
            )}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
