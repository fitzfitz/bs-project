import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useBookingStore } from "@/features/booking/store";
import { useAvailability } from "../api/use-availability";
import { useJoinWaitlist } from "../api/use-waitlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, addDays, isSameDay } from "date-fns";

const DATES = Array.from({ length: 14 }).map((_, i) => addDays(new Date(), i));

export default function TimeSelection() {
  const { t } = useTranslation(["booking", "common"]);
  const { branchId } = useParams();
  const navigate = useNavigate();
  const {
    selectedDate,
    selectedTimeSlot,
    selectedBarberId,
    selectedServiceIds,
    setDateTime,
  } = useBookingStore();
  const joinWaitlist = useJoinWaitlist();
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const [localDate, setLocalDate] = useState<Date>(selectedDate || DATES[0]);
  const [localTime, setLocalTime] = useState<string | null>(selectedTimeSlot);

  const dateStr = format(localDate, "yyyy-MM-dd");
  const { data: slotsData, isLoading } = useAvailability(
    branchId,
    dateStr,
    selectedBarberId ?? undefined,
  );
  const slots = slotsData?.data ?? [];

  const isTodayDate = isSameDay(localDate, new Date());
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const handleNext = () => {
    if (localDate && localTime) {
      setDateTime(localDate, localTime);
      navigate(`/book/${branchId}/confirm`);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t("booking:selectTime")}
        </h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          {t("booking:selectTimeSubtitle")}
        </p>
      </div>

      <div className="flex-1 space-y-8">
        {/* Date Selection Strip */}
        <div>
          <h3 className="font-bold text-slate-800 tracking-wide text-sm flex items-center gap-2 mb-3">
            <CalendarIcon className="w-4 h-4 text-primary" />
            {t("booking:chooseDate")}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar -mx-6 px-6">
            {DATES.map((date) => {
              const isSelected = isSameDay(date, localDate);
              const isToday = isSameDay(date, new Date());
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    setLocalDate(date);
                    setLocalTime(null);
                    setWaitlistSuccess(false);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[72px] h-[88px] rounded-2xl border transition-all duration-300 snap-start shrink-0",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "border-slate-200 bg-white hover:border-slate-300 shadow-sm text-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider mb-1",
                      isSelected
                        ? "text-primary-foreground/80"
                        : "text-slate-400",
                    )}
                  >
                    {isToday ? t("booking:today") : format(date, "EEE")}
                  </span>
                  <span className="text-2xl font-bold font-sans tracking-tight">
                    {format(date, "d")}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      isSelected
                        ? "text-primary-foreground/80"
                        : "text-slate-400",
                    )}
                  >
                    {format(date, "MMM")}
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
            {t("booking:availableSlots")}
          </h3>

          {isLoading ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              {t("booking:loadingTimes")}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-slate-400 text-sm">{t("booking:noSlots")}</p>
              <p className="text-slate-500 text-xs leading-relaxed px-2">
                {t("booking:waitlistDescription")}
              </p>
              {waitlistSuccess && (
                <p className="text-sm font-semibold text-primary">
                  {t("booking:waitlistJoined")}
                </p>
              )}
              {branchId && selectedServiceIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={joinWaitlist.isPending || waitlistSuccess}
                  onClick={() => {
                    joinWaitlist.mutate(
                      {
                        branchId,
                        preferredDate: dateStr,
                        preferredTimeSlot: "ANY",
                        serviceIds: selectedServiceIds,
                        staffProfileId: selectedBarberId ?? undefined,
                      },
                      {
                        onSuccess: () => setWaitlistSuccess(true),
                      },
                    );
                  }}
                >
                  {joinWaitlist.isPending
                    ? t("common:loading")
                    : t("booking:joinWaitlist")}
                </Button>
              ) : null}
              {joinWaitlist.isError && (
                <p className="text-xs text-red-600">
                  {joinWaitlist.error instanceof Error
                    ? joinWaitlist.error.message
                    : String(joinWaitlist.error)}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slots.map((slot) => {
                let isPastTime = false;
                if (isTodayDate) {
                  const [slotHour, slotMinute] = slot.time
                    .split(":")
                    .map(Number);
                  if (
                    slotHour < currentHours ||
                    (slotHour === currentHours && slotMinute <= currentMinutes)
                  ) {
                    isPastTime = true;
                  }
                }
                const isAvailable = slot.available && !isPastTime;
                const isSelected = localTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    onClick={() => isAvailable && setLocalTime(slot.time)}
                    disabled={!isAvailable}
                    className={cn(
                      "py-3.5 rounded-xl border text-sm font-bold transition-all duration-300",
                      !isAvailable
                        ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        : isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 shadow-sm",
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-51">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {t("booking:selectedSlot")}
              </div>
              <div className="text-md font-bold text-slate-900 mt-0.5">
                {format(localDate, "MMM d, yyyy")} &bull; {localTime}
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-xl px-8 h-12 shadow-primary/30 shadow-lg text-md font-semibold"
              onClick={handleNext}
            >
              {t("common:continue")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
