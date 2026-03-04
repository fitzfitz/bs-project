import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, BellOff, Mail } from 'lucide-react';
import { useNotifications } from '@/features/profile/api/use-notifications';
import { Button } from '@/components/ui/button';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { isInitialized, isPushEnabled, enablePush } = useNotifications();

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
          
          <h1 className="font-bold text-slate-900 leading-tight">Notification Settings</h1>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <p className="text-slate-500 text-sm">
          Keep track of your upcoming appointments, special offers, and loyalty points.
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
              {isPushEnabled ? 'Enabled' : 'Turn On Push Notifications'}
            </Button>
            {isPushEnabled && (
               <p className="text-xs text-slate-400 text-center mt-3">
                To turn off, you must change your browser or OS settings.
               </p>
            )}
          </div>
        </div>

        {/* Email Opt-in (Placeholders for backend implementation) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Email Updates</h3>
                <p className="text-sm text-slate-500 mt-1">Receive booking receipts, promotions, and loyalty summaries.</p>
              </div>
            </div>
            {/* Native Tailwind Toggle Snippet */}
            <label className="relative inline-flex items-center cursor-pointer pt-1">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
