import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore, canAccessAdmin } from "@/features/auth/store";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated());
  const tenantRole = useSessionStore((s) => s.user?.tenantRole);
  const isCustomer = useSessionStore((s) => s.user?.isCustomer);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!canAccessAdmin(tenantRole, isCustomer)) {
    setTimeout(() => {
      navigate("/logout");
    }, 2000);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">
          Access denied. This app is for staff only.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
