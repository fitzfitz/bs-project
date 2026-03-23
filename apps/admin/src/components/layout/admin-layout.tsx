import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useSessionStore } from "@/features/auth/store";
import { useAuthMe } from "@/features/auth/api/use-auth-me";
import { Sidebar } from "./sidebar";
import { OfflineBanner } from "@/features/pos/components/offline-banner";
import { SyncIndicator } from "@/features/pos/components/sync-indicator";
import { PanelLeftClose, PanelLeftOpen, LogOut, User } from "lucide-react";

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  useAuthMe();

  return (
    <div className="flex h-screen flex-col bg-[#f8f9fb]">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" />
              )}
            </button>

            <div className="flex-1" />

            <SyncIndicator />

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 ring-2 ring-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] font-medium text-primary/80 leading-tight">
                  {user?.tenantRole?.name ?? "Staff"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => clearSession()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
