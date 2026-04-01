import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, MapPin, ChevronRight, ArrowRight, User, AlertCircle, Scissors, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/features/auth/store';
import { useHistory } from '@/features/profile/api/use-history';
import { useLoyalty } from '@/features/profile/api/use-loyalty';
import { useBranches } from '@/features/branches/api/use-branches';
import { useUnreadCount } from '@/features/notifications/api/use-notifications';
import { usePusherChannel } from '@/hooks/use-pusher';

export default function HomePage() {
  const { t } = useTranslation(['home', 'common', 'history']);
  const { user } = useSessionStore();
  const navigate = useNavigate();
  const { data: history, isLoading, error: historyError } = useHistory();
  const { data: loyaltyData, error: loyaltyError } = useLoyalty();
  const loyalty = loyaltyData?.data;
  const { data: branches, error: branchesError } = useBranches();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  const activeBranchId = branches?.[0]?.id ?? null;
  const historyKeys = useMemo(() => [["my-bookings"]], []);
  usePusherChannel(
    activeBranchId ? `branch-${activeBranchId}` : null,
    "QUEUE_UPDATED",
    historyKeys,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const activeApt = history?.find(h => {
    const isActiveStatus = h.status === 'WAITING' || h.status === 'CALLED';
    if (!isActiveStatus) return false;
    const dateStr = h.booking?.scheduledAt ?? h.createdAt;
    return new Date(dateStr) >= todayStart;
  });

  const STATUS_COLORS: Record<string, string> = {
    WAITING: 'bg-amber-100 text-amber-700',
    CALLED: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header Area */}
      <header className="px-6 pt-12 pb-6 bg-primary text-primary-foreground rounded-b-3xl relative overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-2xl font-bold font-sans tracking-tight">
              {user
                ? t('home:greeting', { name: user.firstName || t('home:defaultName') })
                : t('home:guestGreeting')}
            </h1>
            <button
              onClick={() => navigate('/book')}
              className="flex items-center gap-1 text-primary-foreground/80 mt-1 text-sm hover:text-primary-foreground transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>{branches?.[0]?.name ?? t('home:selectBranch')}</span>
              <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
            </button>
          </div>
          
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 bg-white/20 rounded-full backdrop-blur-sm transition-transform active:scale-95"
          >
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 rounded-full border-2 border-primary text-[10px] font-bold text-white leading-none px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {user && (
          loyaltyError ? (
            <div className="mt-8 bg-red-500/20 backdrop-blur-md rounded-2xl p-3 border border-red-400/30 flex items-center gap-2 text-sm text-white/90">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {t('home:loyaltyLoadError')}
            </div>
          ) : (
            <button
              onClick={() => navigate('/loyalty')}
              className="mt-8 w-full bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex justify-between items-center shadow-lg hover:bg-white/15 transition-colors text-left"
            >
              <div>
                <div className="text-xs font-medium text-white/80 uppercase tracking-wider mb-1">{t('home:yourStatus')}</div>
                <div className="text-lg font-bold flex items-center gap-2">
                  <span>{loyalty?.tier ?? t('home:member')}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-white/80 uppercase tracking-wider mb-1">{t('home:points')}</div>
                <div className="text-xl font-bold">{loyalty?.pointsBalance?.toLocaleString() ?? "—"}</div>
              </div>
            </button>
          )
        )}
      </header>

      {/* Main Content Area */}
      <div className="px-6 py-8 space-y-8">
        
        {/* Quick Actions */}
        <section>
          <div className="grid grid-cols-2 gap-4">
            <Button 
              size="lg" 
              className="h-16 text-md font-semibold rounded-xl shadow-md border border-primary/10"
              onClick={() => navigate('/book')}
            >
              {t('home:bookNewCut')}
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="h-16 text-md font-semibold rounded-xl shadow-sm text-primary border-primary/20"
              onClick={() => navigate('/book')}
            >
              {t('home:viewBranches')}
            </Button>
          </div>
        </section>

        {/* Upcoming Appointment Widget */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">{t('home:upcomingAppointment')}</h2>
            <button className="text-sm font-medium text-primary hover:underline" onClick={() => navigate('/history')}>{t('home:seeAll')}</button>
          </div>
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
            {historyError ? (
              <div className="flex items-center gap-2 text-sm text-red-500 py-4 justify-center">
                <AlertCircle className="w-4 h-4" />
                Failed to load appointments
              </div>
            ) : isLoading ? (
               <div className="text-center text-sm text-slate-500 py-4">Loading active appointments...</div>
            ) : activeApt ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[activeApt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {activeApt.status === 'CALLED' ? t('home:called') : t('home:waiting')}
                  </span>
                </div>

                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {activeApt.booking?.items?.map(i => i.service.name).join(', ') || t('home:defaultService')}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t('home:atVenue', { name: activeApt.branch?.name || t('history:barberShop') })}
                    </p>
                    {activeApt.staff && (
                      <div className="flex items-center gap-1.5 text-sm text-primary mt-1.5">
                        <Scissors className="w-3.5 h-3.5" />
                        <span className="font-medium">{activeApt.staff.user.firstName} {activeApt.staff.user.lastName}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {new Date(activeApt.booking?.scheduledAt ?? activeApt.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-sm text-primary font-bold">
                      {new Date(activeApt.booking?.scheduledAt ?? activeApt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      ~{activeApt.booking?.totalDuration ?? 0}min
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-100" />

                <Button variant="ghost" className="w-full text-primary bg-primary/10 hover:bg-primary/20 font-semibold gap-2 transition-colors" onClick={() => navigate('/history')}>
                  {t('home:trackQueueStatus')} <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
                <div className="text-center py-6 flex flex-col items-center justify-center">
                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                     <User className="w-6 h-6 text-slate-300" />
                   </div>
                   <p className="text-slate-500 text-sm font-medium">{t('home:noUpcoming')}</p>
                   <Button variant="link" className="mt-1 text-primary" onClick={() => navigate('/book')}>
                     {t('home:bookNow')}
                   </Button>
                </div>
            )}
          </div>
        </section>

        {/* Discovery Area */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Our Branches</h2>
          </div>
          
          <div className="space-y-3">
            {branchesError ? (
              <div className="flex items-center gap-2 text-sm text-red-500 py-4 justify-center">
                <AlertCircle className="w-4 h-4" />
                {t('home:failedLoadBranches')}
              </div>
            ) : branches?.length ? (
              branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer text-left"
                  onClick={() => navigate(`/book/${branch.id}`)}
                >
                  <span className="font-medium text-slate-800">{branch.name}</span>
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 text-sm">{t('home:noBranchesLoaded')}</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
