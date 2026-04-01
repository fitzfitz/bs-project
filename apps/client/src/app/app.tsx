import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/routes/_guards/protected-route';
import HomePage from '@/pages/home/home-page';
import LoginPage from '@/pages/auth/login-page';
import RegisterPage from '@/pages/auth/register-page';
import ForgotPasswordPage from '@/pages/auth/forgot-password-page';
import BranchesPage from '@/pages/branches/branches-page';
import BookingLayout from '@/pages/booking/booking-layout';
import ServiceSelection from '@/features/booking/components/service-selection';
import BarberSelection from '@/features/booking/components/barber-selection';
import TimeSelection from '@/features/booking/components/time-selection';
import BookingConfirm from '@/features/booking/components/booking-confirm';
import HistoryTracker from '@/pages/profile/history-page';
import ProfilePage from '@/pages/profile/profile-page';
import EditProfilePage from '@/pages/profile/edit-profile-page';
import NotificationSettings from '@/pages/profile/notification-settings-page';
import ReceiptPage from '@/pages/profile/receipt-page';
import NotificationsPage from '@/pages/notifications/notifications-page';
import PaymentMethodsPage from '@/pages/payments/payment-methods-page';
import LoyaltyPage from '@/pages/loyalty/loyalty-page';
import TermsOfService from '@/pages/legal/terms-of-service-page';
import PrivacyPolicy from '@/pages/legal/privacy-policy-page';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Public */}
        <Route index element={<HomePage />} />
        <Route path="book">
          <Route index element={<BranchesPage />} />
          <Route path=":branchId" element={<ProtectedRoute><BookingLayout /></ProtectedRoute>}>
            <Route index element={<ServiceSelection />} />
            <Route path="barber" element={<BarberSelection />} />
            <Route path="time" element={<TimeSelection />} />
            <Route path="confirm" element={<BookingConfirm />} />
          </Route>
        </Route>

        {/* Protected */}
        <Route path="history" element={<ProtectedRoute><HistoryTracker /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="payment-methods" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
        <Route path="settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
        <Route path="loyalty" element={<ProtectedRoute><LoyaltyPage /></ProtectedRoute>} />
        <Route path="receipt/:transactionId" element={<ProtectedRoute><ReceiptPage /></ProtectedRoute>} />
      </Route>

      {/* Static / Policy Routes */}
      <Route path="/legal/terms" element={<TermsOfService />} />
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />

      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    </Routes>
  );
}

export default App;
