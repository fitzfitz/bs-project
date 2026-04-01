import { useSessionStore, hasPermission } from "@/features/auth/store";
import { DashboardOverview } from "@/features/dashboard/widgets/dashboard-overview";
import { BarberDashboard } from "@/features/dashboard/widgets/barber-dashboard";
import { PageContainer } from "@/components/ui/page-container";

export default function DashboardPage() {
  const permissions = useSessionStore((s) => s.user?.permissions);
  const canViewTransactions = hasPermission(permissions, "TRANSACTION", "canRead");

  if (!canViewTransactions) {
    return (
      <PageContainer>
        <BarberDashboard />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <DashboardOverview />
    </PageContainer>
  );
}
