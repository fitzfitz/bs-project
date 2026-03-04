import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore } from "@/features/auth/store";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated());

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
