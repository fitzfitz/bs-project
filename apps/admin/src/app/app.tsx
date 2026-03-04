import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/routes/_guards/protected-route";

const LoginPage = lazy(() => import("@/pages/auth/login-page"));
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
const MySchedulePage = lazy(() => import("@/pages/barber-portal/my-schedule"));
const MyCommissionsPage = lazy(() => import("@/pages/barber-portal/my-commissions"));
const MyAttendancePage = lazy(() => import("@/pages/barber-portal/my-attendance"));

// Phase 6: Super Admin pages
const AnalyticsPage = lazy(() => import("@/pages/analytics/page"));
const ReportsPage = lazy(() => import("@/pages/reports/page"));
const UsersPage = lazy(() => import("@/pages/users/page"));
const AuditPage = lazy(() => import("@/pages/audit/page"));
const FinancePage = lazy(() => import("@/pages/finance/page"));
const ConfigPage = lazy(() => import("@/pages/config/page"));

function Fallback() {
  return <div className="p-4">Loading...</div>;
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="barbers" element={<BarbersPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="commissions" element={<CommissionsPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="cash-drawer" element={<CashDrawerPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="branches" element={<BranchSettingsPage />} />
          {/* Barber Portal */}
          <Route path="my-schedule" element={<MySchedulePage />} />
          <Route path="my-commissions" element={<MyCommissionsPage />} />
          <Route path="my-attendance" element={<MyAttendancePage />} />
          {/* Phase 6: Super Admin */}
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
