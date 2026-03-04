import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Trash2, Clock, MapPin, Receipt, X, CalendarClock, ChevronDown, Scissors, FileText, Star } from 'lucide-react';
import { useSessionStore } from '@/features/auth/store';
import { useHistory } from '@/features/profile/api/use-history';
import { useCancelBooking } from '@/features/booking/api/use-cancel-booking';
import { useRescheduleBooking } from '@/features/booking/api/use-reschedule-booking';
import { useAvailability } from '@/features/booking/api/use-availability';
import { useConfirmation } from '@/components/ui/confirmation';
import { Button } from '@/components/ui/button';
import { PostReviewDialog } from '@/features/reviews/widgets/post-review-dialog';
import { usePusherChannel } from '@/hooks/use-pusher';
import { format } from 'date-fns';
import type { BookingHistoryItem } from '@/features/profile/types';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  WAITING: { label: 'Waiting', cls: 'bg-amber-100 text-amber-700' },
  CALLED: { label: 'Called', cls: 'bg-blue-100 text-blue-700' },
  IN_SERVICE: { label: 'In Chair', cls: 'bg-green-100 text-green-700' },
  COMPLETED: { label: 'Completed', cls: 'bg-slate-100 text-slate-600' },
  NO_SHOW: { label: 'No Show', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  AT_CHECKOUT: { label: 'Checkout', cls: 'bg-purple-100 text-purple-700' },
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
};

function RescheduleModal({
  item,
  onClose,
}: {
  item: BookingHistoryItem;
  onClose: () => void;
}) {
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
          <h3 className="text-lg font-bold text-slate-900">Reschedule</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
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

        <label className="block text-sm font-medium text-slate-700 mb-2">Available Slots</label>
        {slotsLoading ? (
          <p className="text-sm text-slate-400 py-4 text-center">Loading slots...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No slots available for this date</p>
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
          {reschedule.isPending ? 'Rescheduling...' : 'Confirm New Time'}
        </Button>

        {reschedule.error && (
          <p className="text-xs text-red-500 mt-2 text-center">
            {reschedule.error.message || 'Failed to reschedule'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function HistoryTracker() {
  const { user } = useSessionStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const { data: bookings, isLoading } = useHistory();
  const cancelBooking = useCancelBooking();
  const { confirm } = useConfirmation();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleItem, setRescheduleItem] = useState<BookingHistoryItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<BookingHistoryItem | null>(null);

  const activeBranchId = bookings?.find(
    (b) => b.status === 'WAITING' || b.status === 'CALLED' || b.status === 'IN_SERVICE'
  )?.branchId ?? null;
  const queueQueryKeys = useMemo(() => [["history"]], []);
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
    const dateStr = b.booking?.scheduledAt ?? b.scheduledFor ?? b.createdAt;
    return new Date(dateStr) >= todayStart;
  }) || [];

  const past = bookings?.filter(b => {
    if (b.status !== 'WAITING' && b.status !== 'CALLED') return true;
    const dateStr = b.booking?.scheduledAt ?? b.scheduledFor ?? b.createdAt;
    return new Date(dateStr) < todayStart;
  }) || [];

  const displayList = activeTab === 'upcoming' ? upcoming : past;

  async function handleCancel(id: string) {
    if (cancellingId) return;
    const ok = await confirm({
      title: 'Cancel Appointment?',
      description: 'This action cannot be undone. Your queue position will be lost and you will need to rebook.',
      confirmLabel: 'Yes, Cancel',
      cancelLabel: 'Keep It',
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
        <h2 className="text-xl font-bold text-slate-900">Sign in to view history</h2>
        <p className="text-slate-500 text-sm mt-2">Create an account to track your loyalty points and upcoming appointments.</p>
        <Button className="mt-6 w-full max-w-xs" asChild>
          <a href="/login">Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-20">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">My Appointments</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl mt-6">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'upcoming' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'past' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Past
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-slate-400">Loading your schedule...</div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No {activeTab} appointments</h3>
            <p className="text-slate-500 text-sm mt-1">Ready for a fresh cut?</p>
            <Button className="mt-6" variant="outline" asChild>
              <a href="/book">Book Now</a>
            </Button>
          </div>
        ) : (
          displayList.map(item => {
            const dateStr = item.booking?.scheduledAt ?? item.scheduledFor ?? item.createdAt;
            const branchLabel = item.branch?.name ?? `Branch ${item.branchId.slice(0, 8)}...`;
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
                        {format(new Date(dateStr), 'HH:mm')} ~ {item.estimatedDuration}m
                      </div>
                      <div className="flex items-center text-xs font-medium text-slate-500 mt-1 gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{branchLabel}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_LABELS[item.status]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[item.status]?.label ?? item.status}
                        </span>
                        {item.transaction && (
                          <Link
                            to={`/receipt/${item.transaction.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors"
                          >
                            <Receipt className="w-3 h-3" />
                            Receipt
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
                          <Scissors className="w-3 h-3" /> Services
                        </h4>
                        <div className="space-y-1.5">
                          {bookingItems.map((bi, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-slate-700">{bi.service.name} <span className="text-slate-400">({bi.service.durationMinutes}m)</span></span>
                              <span className="text-slate-600 font-medium tabular-nums">
                                Rp {bi.service.basePrice.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-100">
                            <span className="text-slate-900">Total</span>
                            <span className="text-primary tabular-nums">Rp {totalPrice.toLocaleString('id-ID')}</span>
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
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Timeline</h4>
                      <div className="space-y-2">
                        <TimelineStep label="Created" time={item.createdAt} done />
                        <TimelineStep label="Called" time={item.calledAt} done={!!item.calledAt} />
                        <TimelineStep label="In Chair" time={item.startedAt} done={!!item.startedAt} />
                        <TimelineStep label="Completed" time={item.completedAt} done={!!item.completedAt} />
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
                          onClick={() => handleCancel(item.id)}
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
                          Leave a Review
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

function TimelineStep({ label, time, done }: { label: string; time?: string | null; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? 'bg-primary' : 'bg-slate-200'}`} />
      <span className={`text-xs font-medium ${done ? 'text-slate-700' : 'text-slate-300'}`}>{label}</span>
      {time && done && (
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
          {new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
