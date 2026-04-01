import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { SyncIndicator } from "@/features/pos/components/sync-indicator";
import { AppBreadcrumbs } from "./breadcrumbs";
import { ProfileDropdown } from "./profile-dropdown";

interface TopbarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenCommandMenu: () => void;
  notificationSlot?: React.ReactNode;
}

export function Topbar({
  collapsed,
  onToggleSidebar,
  onOpenCommandMenu,
  notificationSlot,
}: TopbarProps) {
  const { t } = useTranslation();

  return (
    <header
      role="banner"
      className="flex h-[56px] shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
        aria-label="Toggle sidebar"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
      </button>

      <div className="hidden md:block">
        <AppBreadcrumbs />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenCommandMenu}
        className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-slate-100 sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">{t("common:searchPages")}</span>
        <kbd className="ml-4 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
          Ctrl+K
        </kbd>
      </button>

      <SyncIndicator />

      {notificationSlot}

      <div className="h-6 w-px bg-slate-200" />

      <ProfileDropdown />
    </header>
  );
}
