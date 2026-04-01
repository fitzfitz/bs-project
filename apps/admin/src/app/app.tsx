import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/routes/_guards/protected-route";
import { RequirePermission } from "@/routes/_guards/require-permission";

const LoginPage = lazy(() => import("@/pages/auth/login-page"));
const LogoutPage = lazy(() => import("@/pages/auth/logout-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard/page"));
const QueuePage = lazy(() => import("@/pages/queue/page"));
const POSPage = lazy(() => import("@/pages/pos/page"));
const TransactionsPage = lazy(() => import("@/pages/transactions/page"));
const BarbersPage = lazy(() => import("@/pages/barbers/page"));
const AttendancePage = lazy(() => import("@/pages/attendance/page"));
const CommissionsPage = lazy(() => import("@/pages/commissions/page"));
const PayrollPage = lazy(() => import("@/pages/payroll/page"));
const InventoryPage = lazy(() => import("@/pages/inventory/page"));
const BranchSettingsPage = lazy(() => import("@/pages/branches/page"));
const CashDrawerPage = lazy(() => import("@/pages/cash-drawer/page"));
const ReviewsPage = lazy(() => import("@/pages/reviews/page"));
const LoyaltyPage = lazy(() => import("@/pages/loyalty/page"));
const CampaignsPage = lazy(() => import("@/pages/campaigns/page"));
const MySchedulePage = lazy(() => import("@/pages/barber-portal/my-schedule"));
const MyCommissionsPage = lazy(() => import("@/pages/barber-portal/my-commissions"));
const MyAttendancePage = lazy(() => import("@/pages/barber-portal/my-attendance"));

const AnalyticsPage = lazy(() => import("@/pages/analytics/page"));
const ReportsPage = lazy(() => import("@/pages/reports/page"));
const UsersPage = lazy(() => import("@/pages/users/page"));
const AuditPage = lazy(() => import("@/pages/audit/page"));
const FinancePage = lazy(() => import("@/pages/finance/page"));
const ConfigPage = lazy(() => import("@/pages/config/page"));
const ServicesPage = lazy(() => import("@/pages/services/page"));
const CrmPage = lazy(() => import("@/pages/crm/page"));
const NotificationsPage = lazy(() => import("@/pages/notifications/page"));
const RetentionPage = lazy(() => import("@/pages/retention/page"));
const WaitlistPage = lazy(() => import("@/pages/waitlist/page"));

function Fallback() {
  return <div className="p-4">Loading...</div>;
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="queue" element={<RequirePermission feature="QUEUE_MANAGEMENT"><QueuePage /></RequirePermission>} />
          <Route path="pos" element={<RequirePermission feature="TRANSACTION" action="canCreate"><POSPage /></RequirePermission>} />
          <Route path="transactions" element={<RequirePermission feature="TRANSACTION"><TransactionsPage /></RequirePermission>} />
          <Route path="barbers" element={<RequirePermission feature="STAFF_MANAGEMENT"><BarbersPage /></RequirePermission>} />
          <Route path="attendance" element={<RequirePermission feature="ATTENDANCE"><AttendancePage /></RequirePermission>} />
          <Route path="commissions" element={<RequirePermission feature="COMMISSION"><CommissionsPage /></RequirePermission>} />
          <Route path="payroll" element={<RequirePermission feature="PAYROLL"><PayrollPage /></RequirePermission>} />
          <Route path="inventory" element={<RequirePermission feature="INVENTORY"><InventoryPage /></RequirePermission>} />
          <Route path="cash-drawer" element={<RequirePermission feature="CASH_DRAWER"><CashDrawerPage /></RequirePermission>} />
          <Route path="reviews" element={<RequirePermission feature="REVIEWS"><ReviewsPage /></RequirePermission>} />
          <Route path="loyalty" element={<RequirePermission feature="LOYALTY"><LoyaltyPage /></RequirePermission>} />
          <Route path="campaigns" element={<RequirePermission feature="CAMPAIGNS"><CampaignsPage /></RequirePermission>} />
          <Route path="branches" element={<RequirePermission feature="BRANCH_MANAGEMENT"><BranchSettingsPage /></RequirePermission>} />
          {/* Barber Portal */}
          <Route path="my-schedule" element={<MySchedulePage />} />
          <Route path="my-commissions" element={<MyCommissionsPage />} />
          <Route path="my-attendance" element={<MyAttendancePage />} />
          {/* Administration */}
          <Route path="analytics" element={<RequirePermission feature="ANALYTICS"><AnalyticsPage /></RequirePermission>} />
          <Route path="reports" element={<RequirePermission feature="REPORTS"><ReportsPage /></RequirePermission>} />
          <Route path="users" element={<RequirePermission feature="USER_MANAGEMENT"><UsersPage /></RequirePermission>} />
          <Route path="audit" element={<RequirePermission feature="AUDIT_LOG"><AuditPage /></RequirePermission>} />
          <Route path="finance" element={<RequirePermission feature="FINANCE_REPORTS"><FinancePage /></RequirePermission>} />
          <Route path="config" element={<RequirePermission feature="ORG_SETTINGS"><ConfigPage /></RequirePermission>} />
          <Route path="crm" element={<RequirePermission feature="CRM"><CrmPage /></RequirePermission>} />
          <Route path="services" element={<RequirePermission feature="SERVICE_CATALOG"><ServicesPage /></RequirePermission>} />
          <Route path="notifications" element={<RequirePermission feature="CAMPAIGNS"><NotificationsPage /></RequirePermission>} />
          <Route path="retention" element={<RequirePermission feature="RETENTION"><RetentionPage /></RequirePermission>} />
          <Route path="waitlist" element={<RequirePermission feature="QUEUE_MANAGEMENT"><WaitlistPage /></RequirePermission>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
