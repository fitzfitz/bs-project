import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CalendarClock, Scissors } from 'lucide-react';
import { useBookingStore } from '@/features/booking/store';
import { useSessionStore } from '@/features/auth/store';
import { useCreateBooking } from '../api/use-create-booking';
import { useServices } from '../api/use-services';
import type { ServiceResponse } from '../types';
import { useProfile } from '@/features/profile/api/use-profile';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function BookingConfirm() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { user } = useSessionStore();
  const { selectedServiceIds, selectedBarberId, selectedDate, selectedTimeSlot, resetBooking } = useBookingStore();

  const { data: userProfile } = useProfile();

  // 2. Fetch selected services details for summary
  const { data: servicesRaw } = useServices();

  const selectedServicesData: ServiceResponse[] = servicesRaw?.filter((s: ServiceResponse) => selectedServiceIds.includes(s.id)) || [];
  const totalDuration = selectedServicesData.reduce((acc: number, curr: ServiceResponse) => acc + curr.durationMinutes, 0);
  const totalPrice = selectedServicesData.reduce((acc: number, curr: ServiceResponse) => acc + curr.basePrice, 0);

  // 3. Mutation to submit booking
  const { mutate: submitBooking, isPending, error } = useCreateBooking();
  
  const handleConfirm = () => {
    if (!selectedDate || !selectedTimeSlot || !branchId) return;
    const [hours, minutes] = selectedTimeSlot.split(':');
    const startTimeObj = new Date(selectedDate);
    startTimeObj.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const customerName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : (user?.firstName ?? 'Guest');

    submitBooking({
      branchId,
      customerId: user?.id,
      customerName,
      staffProfileId: selectedBarberId || undefined,
      serviceIds: selectedServiceIds,
      startTime: startTimeObj.toISOString(),
      estimatedDuration: totalDuration,
      source: 'APP',
    }, {
      onSuccess: () => {
        resetBooking();
        navigate('/history', { replace: true });
      }
    });
  };

  if (!selectedDate || !selectedTimeSlot || selectedServiceIds.length === 0) {
    return (
      <div className="text-center p-8 mt-10">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Incomplete Booking</h3>
        <p className="text-slate-500 text-sm mt-2">Please go back and ensure you've selected a service, date, and time.</p>
        <Button className="mt-6" onClick={() => navigate(`/book/${branchId}`)}>Restart Booking</Button>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Review & Confirm</h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          Almost there. Review your appointment details below before confirming.
        </p>
      </div>

      <div className="space-y-6">
        {/* Date & Time Ticket */}
        <div className="bg-primary text-primary-foreground p-6 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-between">
          <div>
            <div className="text-primary-foreground/80 text-sm font-semibold uppercase tracking-wider mb-1">Appointment Time</div>
            <div className="text-2xl font-bold">{format(selectedDate, 'EEEE, MMM d')}</div>
            <div className="text-3xl font-black mt-1">{selectedTimeSlot}</div>
          </div>
          <CalendarClock className="w-12 h-12 opacity-50" />
        </div>

        {/* Services Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
            <Scissors className="w-4 h-4 text-primary" /> Services
          </h3>
          <div className="space-y-3">
            {selectedServicesData.map(svc => (
              <div key={svc.id} className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800 text-[15px]">{svc.name}</div>
                  <div className="text-slate-400 text-xs">{svc.durationMinutes} mins</div>
                </div>
                <div className="font-semibold text-slate-700">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(svc.basePrice)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-lg">
            <span className="font-bold text-slate-900">Total (~{totalDuration}m)</span>
            <span className="font-bold text-primary">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
            </span>
          </div>
          <div className="mt-2 text-xs text-center text-slate-400 font-medium">Payment is handled at the branch after your service.</div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100">
            {error.message}
          </div>
        )}

        <Button 
          size="lg" 
          disabled={isPending}
          onClick={handleConfirm}
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20"
        >
          {isPending ? 'Confirming...' : 'Confirm Appointment'}
        </Button>
      </div>
    </div>
  );
}
