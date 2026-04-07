import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, BellOff, Mail } from 'lucide-react';
import { useNotifications } from '@/features/profile/api/use-notifications';
import { api, type ApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';

type NotificationPreferences = {
  pushOptOut: boolean;
  whatsappOptOut: boolean;
  smsOptOut: boolean;
  emailOptOut: boolean;
};

export default function NotificationSettings() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const { isInitialized, isPushEnabled, enablePush } = useNotifications();
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    pushOptOut: false,
    whatsappOptOut: false,
    smsOptOut: false,
    emailOptOut: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<NotificationPreferences>>('/notifications/preferences')
      .then((res) => setPrefs(res.data))
      .catch(console.warn)
      .finally(() => setIsLoading(false));
  }, []);

  const handleEmailToggle = async () => {
    const newOptOut = !prefs.emailOptOut;
    const updatedPrefs = { ...prefs, emailOptOut: newOptOut };
    setPrefs(updatedPrefs);
    setIsSaving(true);
    try {
      await api.put('/notifications/preferences', updatedPrefs);
    } catch {
      setPrefs({ ...prefs, emailOptOut: !newOptOut });
    } finally {
      setIsSaving(false);
    }
  };

  // Email is enabled when NOT opted out
  const emailEnabled = !prefs.emailOptOut;

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 relative">
      <div className="bg-white shadow-sm z-10 sticky top-0">
        <div className="px-4 h-16 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700 -ml-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <h1 className="font-bold text-slate-900 leading-tight">{t('settings')}</h1>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <p className="text-slate-500 text-sm">
          {t('settingsIntro')}
        </p>

        {/* Push Notifications Toggle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPushEnabled ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                {isPushEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Push Notifications</h3>
                <p className="text-sm text-slate-500 mt-1">Get immediate alerts on your device for bookings and walk-in queue updates.</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <Button 
              disabled={!isInitialized || isPushEnabled} 
              onClick={() => enablePush(true)}
              className="w-full"
              variant={isPushEnabled ? "secondary" : "default"}
            >
              {isPushEnabled ? t('enabled') : t('turnOnPush')}
            </Button>
            {isPushEnabled && (
               <p className="text-xs text-slate-400 text-center mt-3">
                {t('pushOffHint')}
               </p>
            )}
          </div>
        </div>

        {/* Email Notifications Toggle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${emailEnabled ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{t('emailUpdates')}</h3>
                <p className="text-sm text-slate-500 mt-1">{t('emailDescription')}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer pt-1">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={emailEnabled}
                onChange={handleEmailToggle}
                disabled={isSaving || isLoading}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
