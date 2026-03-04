import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserCircle2, Sparkles, ChevronRight, Star, MessageSquare, ChevronDown } from 'lucide-react';
import { useBookingStore } from '@/features/booking/store';
import { useBarbers } from '../api/use-barbers';
import { cn } from '@/lib/utils';
import { ReviewFeed } from '@/features/reviews/widgets/review-feed';

export default function BarberSelection() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { selectedBarberId, setBarber } = useBookingStore();
  const [reviewsBarber, setReviewsBarber] = useState<string | null>(null);

  const { data: barbers, isLoading } = useBarbers(branchId);

  const handleSelect = (id: string | null) => {
    setBarber(id);
    navigate(`/book/${branchId}/time`);
  };

  if (isLoading) {
    return <div className="text-center p-8 text-slate-400">Loading barbers...</div>;
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Select Barber</h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          Choose a specific barber or let us pick the first available one for you.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {/* Any Available Option */}
        <button
          onClick={() => handleSelect(null)}
          className={cn(
            "w-full flex items-center p-5 rounded-2xl border transition-all duration-300",
            selectedBarberId === null 
              ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
              : "border-slate-200 bg-white hover:border-primary/30 shadow-sm"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left pl-4">
            <div className="font-bold text-slate-900 text-[16px]">Any Available</div>
            <p className="text-sm text-slate-500 mt-0.5">Fastest wait time</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>

        {/* List of specific barbers */}
        <div className="pt-4 pb-2">
          <h3 className="font-bold text-slate-800 tracking-wide text-sm uppercase">Our Team</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {barbers?.map((barber) => (
            <div key={barber.id} className="space-y-0">
              <div
                className={cn(
                  "w-full flex items-center p-4 border transition-all duration-300",
                  reviewsBarber === barber.id ? "rounded-t-2xl" : "rounded-2xl",
                  selectedBarberId === barber.id 
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
                    : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                )}
              >
                <button
                  onClick={() => handleSelect(barber.id)}
                  className="flex items-center flex-1 text-left"
                >
                  <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                    {barber.avatarUrl ? (
                      <img src={barber.avatarUrl} alt={barber.user.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 text-[16px]">{barber.user.firstName} {barber.user.lastName}</div>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {barber.tier}
                      </span>
                    </div>
                    {barber.specialties && barber.specialties.length > 0 && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                        {barber.specialties.join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      {barber.totalReviews > 0 ? (
                        <>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold text-slate-700">
                            {barber.averageRating.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({barber.totalReviews} review{barber.totalReviews !== 1 ? 's' : ''})
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No reviews yet</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                </button>

                {barber.totalReviews > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewsBarber(reviewsBarber === barber.id ? null : barber.id);
                    }}
                    className="ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors shrink-0"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <ChevronDown className={cn("w-3 h-3 transition-transform", reviewsBarber === barber.id && "rotate-180")} />
                  </button>
                )}
              </div>

              {reviewsBarber === barber.id && (
                <div className="border border-t-0 border-slate-200 rounded-b-2xl bg-slate-50 p-4">
                  <ReviewFeed
                    staffProfileId={barber.id}
                    averageRating={barber.averageRating}
                    totalReviews={barber.totalReviews}
                    pageSize={3}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
