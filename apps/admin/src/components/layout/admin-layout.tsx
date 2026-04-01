import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuthMe } from "@/features/auth/api/use-auth-me";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandMenu } from "./command-menu";
import { useCommandMenu } from "@/hooks/use-command-menu";
import { OfflineBanner } from "@/features/pos/components/offline-banner";

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { open: commandMenuOpen, setOpen: setCommandMenuOpen } =
    useCommandMenu();
  useAuthMe();

  return (
    <div className="flex h-screen flex-col bg-[#f8f9fb]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((c) => !c)}
            onOpenCommandMenu={() => setCommandMenuOpen(true)}
          />
          <main id="main-content" className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </div>
  );
}
