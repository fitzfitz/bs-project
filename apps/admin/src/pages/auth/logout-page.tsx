import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/features/auth/store";
import { queryClient } from "@/lib/query-client";
import { Scissors } from "lucide-react";

export default function LogoutPage() {
  const clearSession = useSessionStore((s) => s.clearSession);
  const navigate = useNavigate();

  useEffect(() => {
    clearSession();
    queryClient.clear();

    const timer = setTimeout(() => navigate("/login", { replace: true }), 600);
    return () => clearTimeout(timer);
  }, [clearSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25 animate-pulse">
          <Scissors className="h-7 w-7 text-white" />
        </div>
        <p className="text-sm text-slate-500">Signing out…</p>
      </div>
    </div>
  );
}
