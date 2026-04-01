import { useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSessionStore, hasAnyPermission } from "@/features/auth/store";
import { navGroups, barberNav, findGroupForRoute, type NavGroup } from "@/lib/nav-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarGroup } from "./sidebar-group";
import { SidebarNavItem } from "./sidebar-nav-item";

const STORAGE_KEY = "tmng-sidebar-groups";

function loadGroupState(groups: NavGroup[]): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Record<string, boolean>;
  } catch { /* localStorage may be unavailable */ }
  const defaults: Record<string, boolean> = {};
  for (const g of groups) {
    defaults[g.id] = g.defaultOpen ?? false;
  }
  return defaults;
}

function persistGroupState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* localStorage may be unavailable */ }
}

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useSessionStore((s) => s.user);
  const isBarber = !!user?.staffProfile;
  const permissions = user?.permissions;

  const [groupState, setGroupState] = useState<Record<string, boolean>>(() =>
    loadGroupState(navGroups),
  );

  const toggleGroup = useCallback((groupId: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      persistGroupState(next);
      return next;
    });
  }, []);

  const activeGroupId = findGroupForRoute(location.pathname)?.id;

  const effectiveGroupState = useMemo(() => {
    if (activeGroupId && !groupState[activeGroupId]) {
      const expanded = { ...groupState, [activeGroupId]: true };
      persistGroupState(expanded);
      return expanded;
    }
    return groupState;
  }, [groupState, activeGroupId]);

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.feature || hasAnyPermission(permissions, item.feature),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        "shrink-0 border-r border-slate-200/80 bg-white flex flex-col transition-all duration-200 ease-in-out",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-[56px] shrink-0 items-center border-b border-slate-200/80 px-4",
          collapsed ? "justify-center" : "",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
            <span className="text-sm font-black text-white">B</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-bold text-slate-800 tracking-tight">
                Barbershop
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-primary/60">
                Admin
              </span>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2.5">
          {isBarber ? (
            barberNav.map((item) => (
              <SidebarNavItem
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
                collapsed={collapsed}
              />
            ))
          ) : (
            <>
              {filteredGroups.map((group) => (
                <div key={group.id} className="mt-1 first:mt-0">
                  <SidebarGroup
                    label={t(group.labelKey)}
                    icon={group.icon}
                    isOpen={effectiveGroupState[group.id] ?? false}
                    onToggle={() => toggleGroup(group.id)}
                    collapsed={collapsed}
                  >
                    {group.items.map((item) => (
                      <SidebarNavItem
                        key={item.to}
                        to={item.to}
                        label={t(item.labelKey)}
                        icon={item.icon}
                        collapsed={collapsed}
                      />
                    ))}
                  </SidebarGroup>
                </div>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
