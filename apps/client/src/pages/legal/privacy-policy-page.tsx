import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
        <h1 className="font-bold text-slate-900 leading-tight">{t('privacyTitle')}</h1>
      </div>
      <div className="p-6 prose prose-slate mx-auto pb-20 text-sm">
        <h2>1. Information We Collect</h2>
        <p>We collect your name, email, phone number, and location (if granted) to facilitate finding nearest branches and booking appointments.</p>
        
        <h2>2. How We Use It</h2>
        <p>Your data is used strictly for managing your bookings, alerting you of your queue status, and processing payment receipts. We do not sell your personal data.</p>
        
        <h2>3. Data Retention</h2>
        <p>You can delete your account at any time from the Profile page. This will permanently anonymize your past bookings and delete your identity from our database.</p>
      </div>
    </div>
  );
}
