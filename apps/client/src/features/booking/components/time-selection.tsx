import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useBookingStore } from '@/features/booking/store';
import { useAvailability } from '../api/use-availability';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay } from 'date-fns';

const DATES = Array.from({ length: 14 }).map((_, i) => addDays(new Date(), i));

export default function TimeSelection() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { selectedDate, selectedTimeSlot, selectedBarberId, setDateTime } = useBookingStore();

  const [localDate, setLocalDate] = useState<Date>(selectedDate || DATES[0]);
  const [localTime, setLocalTime] = useState<string | null>(selectedTimeSlot);

  const dateStr = format(localDate, 'yyyy-MM-dd');
  const { data: slotsData, isLoading } = useAvailability(branchId, dateStr, selectedBarberId ?? undefined);
  const slots = slotsData?.data ?? [];

  const handleNext = () => {
    if (localDate && localTime) {
      setDateTime(localDate, localTime);
      navigate(`/book/${branchId}/confirm`);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Select Time</h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          Choose a date and time that works best for you.
        </p>
      </div>

      <div className="flex-1 space-y-8">
        {/* Date Selection Strip */}
        <div>
          <h3 className="font-bold text-slate-800 tracking-wide text-sm flex items-center gap-2 mb-3">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Pick a Date
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar -mx-6 px-6">
            {DATES.map((date) => {
              const isSelected = isSameDay(date, localDate);
              const isToday = isSameDay(date, new Date());
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => { setLocalDate(date); setLocalTime(null); }}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[72px] h-[88px] rounded-2xl border transition-all duration-300 snap-start shrink-0",
                    isSelected 
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30" 
                      : "border-slate-200 bg-white hover:border-slate-300 shadow-sm text-slate-700"
                  )}
                >
                  <span className={cn("text-xs font-bold uppercase tracking-wider mb-1", isSelected ? "text-primary-foreground/80" : "text-slate-400")}>
                    {isToday ? 'Today' : format(date, 'EEE')}
                  </span>
                  <span className="text-2xl font-bold font-sans tracking-tight">
                    {format(date, 'd')}
                  </span>
                  <span className={cn("text-[10px] font-semibold", isSelected ? "text-primary-foreground/80" : "text-slate-400")}>
                    {format(date, 'MMM')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots Grid */}
        <div>
          <h3 className="font-bold text-slate-800 tracking-wide text-sm flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            Available Times
          </h3>

          {isLoading ? (
            <div className="text-center py-6 text-slate-400 text-sm">Loading available times...</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">No time slots available on this date.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slots.map((slot) => {
                const isSelected = localTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && setLocalTime(slot.time)}
                    disabled={!slot.available}
                    className={cn(
                      "py-3.5 rounded-xl border text-sm font-bold transition-all duration-300",
                      !slot.available
                        ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        : isSelected 
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 shadow-sm"
                    )}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      {localDate && localTime && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-50">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Selected</div>
              <div className="text-md font-bold text-slate-900 mt-0.5">
                {format(localDate, 'MMM d, yyyy')} &bull; {localTime}
              </div>
            </div>
            
            <Button 
              size="lg" 
              className="rounded-xl px-8 h-12 shadow-primary/30 shadow-lg text-md font-semibold"
              onClick={handleNext}
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
