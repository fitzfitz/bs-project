import { Navigate } from "react-router-dom";
import { useSessionStore, hasPermission } from "@/features/auth/store";

interface RequirePermissionProps {
  feature: string;
  action?: "canCreate" | "canRead" | "canUpdate" | "canDelete";
  children: React.ReactNode;
}

export function RequirePermission({
  feature,
  action = "canRead",
  children,
}: RequirePermissionProps) {
  const permissions = useSessionStore((s) => s.user?.permissions);

  if (!hasPermission(permissions, feature, action)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
