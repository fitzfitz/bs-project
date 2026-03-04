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
    <div className="flex h-screen flex-col bg-slate-50">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            <div className="flex flex-1 items-center gap-2">
              <SyncIndicator />
            </div>
            <div className="flex items-center gap-3">
              <SyncIndicator />
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {user?.tenantRole?.name ?? "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => clearSession()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
