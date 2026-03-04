import { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useBookingStore } from '@/features/booking/store';
import { useBranch } from '@/features/branches/api/use-branch';

export default function BookingLayout() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setBranchInfo, resetBooking } = useBookingStore();

  useEffect(() => {
    if (branchId) {
      setBranchInfo(branchId);
    }
    return () => resetBooking();
  }, [branchId, setBranchInfo, resetBooking]);

  const { data: branch, isLoading } = useBranch(branchId);

  // Calculate generic progress based on route
  const path = location.pathname;
  let progress = 25;
  if (path.includes('barber')) progress = 50;
  if (path.includes('time')) progress = 75;
  if (path.includes('confirm')) progress = 100;

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 relative">
      {/* Booking Header */}
      <div className="bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] z-10 sticky top-0">
        <div className="px-4 h-16 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700 -ml-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1">
            <h1 className="font-bold text-slate-900 leading-tight">Book Appointment</h1>
            {isLoading ? (
              <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse mt-0.5" />
            ) : (
              <div className="flex items-center text-xs text-slate-500 font-medium mt-0.5">
                <MapPin className="w-3 h-3 mr-1" />
                <span className="truncate max-w-[200px]">{branch?.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      {/* Booking Steps Viewport */}
      <div className="flex-1 flex flex-col pt-6 pb-24 px-6 overflow-y-auto">
        <Outlet />
      </div>

    </div>
  );
}
