import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

export default function TermsOfService() {
  const { t } = useTranslation('legal');
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-dvh bg-white relative">
      <div className="bg-white px-4 h-16 flex items-center gap-3 sticky top-0 border-b border-slate-100 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-slate-900 leading-tight">{t('termsTitle')}</h1>
      </div>
      <div className="p-6 prose prose-slate mx-auto pb-20 text-sm">
        <h2>1. Introduction</h2>
        <p>Welcome to The Barber App. By accessing our application, you agree to these terms of service and our privacy policy.</p>
        
        <h2>2. Booking Appointments</h2>
        <p>Appointments can be booked online. We require a valid name and phone number. Our system handles a 10-minute grace period for lateness, after which you may be converted to a walk-in status without penalty.</p>
        
        <h2>3. Payment</h2>
        <p>All payments are handled at the branch checkout counter. You are not charged online during the booking phase.</p>

        <h2>4. Cancellations</h2>
        <p>You may cancel your appointment at any time without penalty via the application to free up the slot for others.</p>
      </div>
    </div>
  );
}
