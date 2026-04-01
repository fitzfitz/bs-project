import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Trash2, Clock, MapPin, Receipt, X, CalendarClock, ChevronDown, Scissors, FileText, Star, ClockArrowUp } from 'lucide-react';
import { useSessionStore } from '@/features/auth/store';
import { useHistory } from '@/features/profile/api/use-history';
import { useCancelBooking } from '@/features/booking/api/use-cancel-booking';
import { useRescheduleBooking } from '@/features/booking/api/use-reschedule-booking';
import { useAvailability } from '@/features/booking/api/use-availability';
import { useMyWaitlist, useLeaveWaitlist } from '@/features/booking/api/use-waitlist';
import { useConfirmation } from '@/components/ui/confirmation';
import { Button } from '@/components/ui/button';
import { PostReviewDialog } from '@/features/reviews/widgets/post-review-dialog';
import { usePusherChannel } from '@/hooks/use-pusher';
import { format } from 'date-fns';
import type { BookingHistoryItem } from '@/features/profile/types';
import type { TFunction } from 'i18next';
import { formatCurrency } from '@/lib/utils';

function buildCancelConfirmationDescription(
  item: BookingHistoryItem,
  t: TFunction,
  formatMoney: (amount: number) => string,
) {
  const base = t('history:cancelAppointmentDescription');
  const b = item.booking as Record<string, unknown> | null | undefined;
  const prepaid = Boolean(b?.prepaid);
  const penaltyPct =
    typeof b?.cancellationPenaltyPercentage === 'number'
      ? b.cancellationPenaltyPercentage
      : null;
  const refundRaw = b?.estimatedRefundAmount;
  const refundAmt = typeof refundRaw === 'number' ? refundRaw : null;

  const lines = [base, '', t('history:cancellationPolicy')];
  if (penaltyPct != null && penaltyPct > 0) {
    lines.push(t('history:cancellationPenalty', { percentage: penaltyPct }));
  } else {
    lines.push(t('history:freeCancellation'));
  }
  if (refundAmt != null) {
    lines.push(t('history:refundInfo', { amount: formatMoney(refundAmt) }));
  }
  if (prepaid) {
    lines.push(t('history:prepaid'));
  }
  return lines.join('\n');
}

function RescheduleModal({
  item,
  onClose,
}: {
  item: BookingHistoryItem;
  onClose: () => void;
}) {
  const { t } = useTranslation(['history', 'booking']);
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const reschedule = useRescheduleBooking();

  const staffProfileId = item.staff ? item.staffProfileId ?? undefined : undefined;
  const { data: slotsData, isLoading: slotsLoading } = useAvailability(
    item.branchId,
    selectedDate,
    staffProfileId
  );

  const slots = slotsData?.data ?? (Array.isArray(slotsData) ? slotsData : []);

  function handleConfirm() {
    if (!selectedTime) return;
    const startTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    reschedule.mutate(
      { entryId: item.id, startTime },
      { onSuccess: () => onClose() }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{t('history:rescheduleTitle')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">{t('history:date')}</label>
        <input
          type="date"
          value={selectedDate}
          min={format(new Date(), 'yyyy-MM-dd')}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedTime(null);
          }}
          className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm mb-4"
        />

        <label className="block text-sm font-medium text-slate-700 mb-2">{t('booking:availableSlots')}</label>
        {slotsLoading ? (
          <p className="text-sm text-slate-400 py-4 text-center">{t('history:loadingSlots')}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{t('booking:noSlots')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto mb-4">
            {slots.map((s: { time: string; available: boolean }) => (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => setSelectedTime(s.time)}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  !s.available
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : selectedTime === s.time
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-primary/10'
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}

        <Button
          className="w-full h-11 rounded-xl"
          disabled={!selectedTime || reschedule.isPending}
          onClick={handleConfirm}
        >
          {reschedule.isPending ? t('history:rescheduling') : t('history:confirmNewTime')}
        </Button>

        {reschedule.error && (
          <p className="text-xs text-red-500 mt-2 text-center">
            {reschedule.error.message || t('history:rescheduleFailed')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function HistoryTracker() {
  const { t } = useTranslation(['history', 'home', 'common']);
  const { user } = useSessionStore();
  const org = useSessionStore((s) => s.user?.organization);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'waitlist'>('upcoming');
  const { data: bookings, isLoading } = useHistory();
  const { data: waitlistEntries, isLoading: waitlistLoading } = useMyWaitlist();
  const leaveWaitlist = useLeaveWaitlist();
  const cancelBooking = useCancelBooking();
  const { confirm } = useConfirmation();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleItem, setRescheduleItem] = useState<BookingHistoryItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<BookingHistoryItem | null>(null);

  const activeBranchId = bookings?.find(
    (b) => b.status === 'WAITING' || b.status === 'CALLED' || b.status === 'IN_SERVICE'
  )?.branchId ?? null;
  const queueQueryKeys = useMemo(() => [["my-bookings"]], []);
  usePusherChannel(
    activeBranchId ? `branch-${activeBranchId}` : null,
    "QUEUE_UPDATED",
    queueQueryKeys,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = bookings?.filter(b => {
    const isActiveStatus = b.status === 'WAITING' || b.status === 'CALLED';
    if (!isActiveStatus) return false;
    const dateStr = b.booking?.scheduledAt ?? b.createdAt;
    return new Date(dateStr) >= todayStart;
  }) || [];

  const past = bookings?.filter(b => {
    if (b.status !== 'WAITING' && b.status !== 'CALLED') return true;
    const dateStr = b.booking?.scheduledAt ?? b.createdAt;
    return new Date(dateStr) < todayStart;
  }) || [];

  const displayList = activeTab === 'upcoming' ? upcoming : past;

  const statusLabels = useMemo(
    () =>
      ({
        WAITING: { label: t('history:waiting'), cls: 'bg-amber-100 text-amber-700' },
        CALLED: { label: t('history:called'), cls: 'bg-blue-100 text-blue-700' },
        IN_SERVICE: { label: t('history:inChair'), cls: 'bg-green-100 text-green-700' },
        COMPLETED: { label: t('history:completed'), cls: 'bg-slate-100 text-slate-600' },
        NO_SHOW: { label: t('history:noShow'), cls: 'bg-red-100 text-red-700' },
        CANCELLED: { label: t('history:cancelled'), cls: 'bg-red-50 text-red-600' },
        AT_CHECKOUT: { label: t('history:checkout'), cls: 'bg-purple-100 text-purple-700' },
        PAID: { label: t('history:paid'), cls: 'bg-emerald-100 text-emerald-700' },
      }) satisfies Record<string, { label: string; cls: string }>,
    [t],
  );

  async function handleCancel(id: string, item: BookingHistoryItem) {
    if (cancellingId) return;
    const ok = await confirm({
      title: t('history:cancelAppointmentTitle'),
      description: buildCancelConfirmationDescription(item, t, (amt) =>
        formatCurrency(amt, org?.currency, org?.locale),
      ),
      confirmLabel: t('history:yesCancel'),
      cancelLabel: t('history:keepIt'),
      variant: 'danger',
    });
    if (!ok) return;
    setCancellingId(id);
    cancelBooking.mutate(id, {
      onSettled: () => setCancellingId(null),
    });
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t('history:signInToViewHistory')}</h2>
        <p className="text-slate-500 text-sm mt-2">{t('history:historyGuestPrompt')}</p>
        <Button className="mt-6 w-full max-w-xs" asChild>
          <a href="/login">{t('history:signIn')}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-20">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">{t('history:myAppointments')}</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl mt-6">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'upcoming' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('history:upcoming')}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'past' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('history:past')}
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'waitlist' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('history:waitlistTab')}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {activeTab === 'waitlist' ? (
          <WaitlistSection
            entries={waitlistEntries as WaitlistEntryData[] | undefined}
            isLoading={waitlistLoading}
            onLeave={(id) => leaveWaitlist.mutate(id)}
            leavingId={leaveWaitlist.variables}
            isLeaving={leaveWaitlist.isPending}
          />
        ) : isLoading ? (
          <div className="text-center py-10 text-slate-400">{t('history:loadingSchedule')}</div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">
              {t('history:noAppointmentsTab', { tab: t(`history:${activeTab}`) })}
            </h3>
            <p className="text-slate-500 text-sm mt-1">{t('history:readyForCut')}</p>
            <Button className="mt-6" variant="outline" asChild>
              <a href="/book">{t('home:bookNow')}</a>
            </Button>
          </div>
        ) : (
          displayList.map(item => {
            const dateStr = item.booking?.scheduledAt ?? item.createdAt;
            const branchLabel = item.branch?.name ?? t('history:branchFallback', { id: item.branchId.slice(0, 8) });
            const barberLabel = item.staff
              ? `${item.staff.user.firstName} ${item.staff.user.lastName}`.trim()
              : null;
            const isActiveStatus = item.status === 'WAITING' || item.status === 'CALLED';
            const isUpcoming = isActiveStatus && new Date(dateStr) >= todayStart;
            const isCancelling = cancellingId === item.id;
            const isExpanded = expandedId === item.id;
            const bookingItems = item.booking?.items ?? [];
            const totalPrice = bookingItems.reduce((acc, bi) => acc + bi.service.basePrice, 0);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"
              >
                {item.status === 'COMPLETED' && <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-[100%] flex items-start justify-end p-2"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>}
                {item.status === 'CANCELLED' && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-[100%] flex items-start justify-end p-2"><Trash2 className="w-4 h-4 text-red-600" /></div>}

                {/* Compact section (always visible, clickable to expand) */}
                <button
                  type="button"
                  className="w-full p-5 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-xl flex flex-col items-center justify-center shrink-0 text-primary">
                      <span className="text-xs font-bold uppercase">{format(new Date(dateStr), 'MMM')}</span>
                      <span className="text-lg font-black leading-none mt-0.5">{format(new Date(dateStr), 'dd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900">{barberLabel ?? item.customerName}</h3>
                      <div className="flex items-center text-xs font-medium text-slate-500 mt-1 gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {format(new Date(dateStr), 'HH:mm')} ~ {item.booking?.totalDuration ?? 0}m
                      </div>
                      <div className="flex items-center text-xs font-medium text-slate-500 mt-1 gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{branchLabel}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${statusLabels[item.status as keyof typeof statusLabels]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                          {statusLabels[item.status as keyof typeof statusLabels]?.label ?? item.status}
                        </span>
                        {item.transaction && (
                          <Link
                            to={`/receipt/${item.transaction.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors"
                          >
                            <Receipt className="w-3 h-3" />
                            {t('history:viewReceipt')}
                          </Link>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-300 shrink-0 transition-transform mt-2 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded detail section */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                    {/* Services list */}
                    {bookingItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                          <Scissors className="w-3 h-3" /> {t('history:services')}
                        </h4>
                        <div className="space-y-1.5">
                          {bookingItems.map((bi, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-slate-700">{bi.service.name} <span className="text-slate-400">({bi.service.durationMinutes}m)</span></span>
                              <span className="text-slate-600 font-medium tabular-nums">
                                {formatCurrency(
                                  bi.service.basePrice,
                                  org?.currency,
                                  org?.locale,
                                )}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-100">
                            <span className="text-slate-900">{t('history:total')}</span>
                            <span className="text-primary tabular-nums">
                              {formatCurrency(totalPrice, org?.currency, org?.locale)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Barber */}
                    {barberLabel && (
                      <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
                        <Scissors className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">{barberLabel}</span>
                      </div>
                    )}

                    {/* Booking note */}
                    {item.booking?.note && (
                      <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                        <FileText className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                        <span>{item.booking.note}</span>
                      </div>
                    )}

                    {/* Status timeline */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('history:timeline')}</h4>
                      <div className="space-y-2">
                        <TimelineStep labelKey="created" time={item.createdAt} done />
                        <TimelineStep labelKey="called" time={item.calledAt} done={!!item.calledAt} />
                        <TimelineStep labelKey="inChairTimeline" time={item.startedAt} done={!!item.startedAt} />
                        <TimelineStep labelKey="completed" time={item.completedAt} done={!!item.completedAt} />
                      </div>
                    </div>

                    {/* Actions (reschedule / cancel) */}
                    {isUpcoming && (
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setRescheduleItem(item)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(item.id, item)}
                          disabled={isCancelling}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          {isCancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    )}

                    {/* Leave a review for completed visits */}
                    {item.status === 'PAID' && (
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setReviewItem(item)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                        >
                          <Star className="w-4 h-4" />
                          {t('history:leaveReview')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {rescheduleItem && (
        <RescheduleModal
          item={rescheduleItem}
          onClose={() => setRescheduleItem(null)}
        />
      )}

      {reviewItem && (
        <PostReviewDialog
          open={!!reviewItem}
          onClose={() => setReviewItem(null)}
          branchId={reviewItem.branchId}
          staffProfileId={reviewItem.staffProfileId ?? undefined}
          queueEntryId={reviewItem.id}
        />
      )}
    </div>
  );
}

function TimelineStep({
  labelKey,
  time,
  done,
}: {
  labelKey: 'created' | 'called' | 'inChairTimeline' | 'completed';
  time?: string | null;
  done: boolean;
}) {
  const { t } = useTranslation('history');
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? 'bg-primary' : 'bg-slate-200'}`} />
      <span className={`text-xs font-medium ${done ? 'text-slate-700' : 'text-slate-300'}`}>{t(labelKey)}</span>
      {time && done && (
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
          {new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

type WaitlistEntryData = {
  id: string;
  preferredDate: string;
  preferredTimeSlot: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  customerName: string;
};

const WAITLIST_STATUS_BADGE: Record<string, string> = {
  WAITING: 'bg-amber-100 text-amber-700',
  NOTIFIED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

function WaitlistSection({
  entries,
  isLoading: loading,
  onLeave,
  leavingId,
  isLeaving,
}: {
  entries: WaitlistEntryData[] | undefined;
  isLoading: boolean;
  onLeave: (id: string) => void;
  leavingId: string | undefined;
  isLeaving: boolean;
}) {
  const { t } = useTranslation('history');

  if (loading) {
    return <div className="text-center py-10 text-slate-400">{t('loadingSchedule')}</div>;
  }

  const items = Array.isArray(entries) ? entries : [];

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ClockArrowUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">{t('noWaitlist')}</h3>
        <p className="text-slate-500 text-sm mt-1">{t('waitlistDesc')}</p>
      </div>
    );
  }

  return (
    <>
      {items.map((entry) => {
        const isActive = entry.status === 'WAITING' || entry.status === 'NOTIFIED';
        const statusKey = `waitlistStatus${entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}` as
          | 'waitlistStatusWaiting'
          | 'waitlistStatusNotified'
          | 'waitlistStatusExpired'
          | 'waitlistStatusCancelled';

        return (
          <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ClockArrowUp className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-slate-900">{entry.customerName}</h3>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${WAITLIST_STATUS_BADGE[entry.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {t(statusKey)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('waitlistPreferredDate')}</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {new Date(entry.preferredDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('waitlistTimeSlot')}</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {entry.preferredTimeSlot}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('waitlistExpires')}</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {new Date(entry.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('waitlistJoinedAt')}</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {new Date(entry.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {isActive && (
              <button
                onClick={() => onLeave(entry.id)}
                disabled={isLeaving && leavingId === entry.id}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                {isLeaving && leavingId === entry.id ? t('waitlistLeaving') : t('waitlistLeave')}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
