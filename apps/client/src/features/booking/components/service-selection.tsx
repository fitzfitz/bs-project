import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CopyPlus } from 'lucide-react';
import { useBookingStore } from '@/features/booking/store';
import { useServices } from '../api/use-services';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ServiceSelection() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { selectedServiceIds, toggleService } = useBookingStore();

  const { data: servicesRaw, isLoading } = useServices();

  // Calculate totals and grouping
  const { groupedServices, totalDuration, totalPrice } = useMemo(() => {
    if (!servicesRaw) return { groupedServices: {}, totalDuration: 0, totalPrice: 0 };

    type ServiceItem = Exclude<typeof servicesRaw, undefined>[number];
    const grouped: Record<string, ServiceItem[]> = {};
    let duration = 0;
    let price = 0;

    servicesRaw.forEach(service => {
      const category = service.category || 'Services';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(service);

      if (selectedServiceIds.includes(service.id)) {
        duration += service.durationMinutes;
        price += service.basePrice;
      }
    });

    return { groupedServices: grouped, totalDuration: duration, totalPrice: price };
  }, [servicesRaw, selectedServiceIds]);

  if (isLoading) {
    return <div className="text-center p-8 text-slate-400">Loading services...</div>;
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Select Services</h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          Choose what you need today. You can select multiple services.
        </p>
      </div>

      <div className="flex-1 space-y-8">
        {Object.entries(groupedServices).map(([category, items]) => (
          <div key={category} className="space-y-4">
            <h3 className="font-bold text-slate-800 tracking-wide text-sm uppercase">{category}</h3>
            <div className="flex flex-col gap-3">
              {(items as Exclude<typeof servicesRaw, undefined>).map((svc) => {
                const isSelected = selectedServiceIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    onClick={() => toggleService(svc.id)}
                    className={cn(
                      "flex items-center text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                      isSelected 
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
                        : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                    )}
                  >
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-slate-900 text-[15px]">{svc.name}</div>
                      {svc.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1 leading-snug">{svc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-sm font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                          {svc.durationMinutes} min
                        </span>
                        <span className="text-primary">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(svc.basePrice)}
                        </span>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                    )}>
                      {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <CopyPlus className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Bar */}
      {selectedServiceIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-50">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{selectedServiceIds.length} Selected</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-slate-900">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                </span>
                <span className="text-sm font-medium text-slate-400">~{totalDuration}m</span>
              </div>
            </div>
            
            <Button 
              size="lg" 
              className="rounded-xl px-8 h-12 shadow-primary/30 shadow-lg text-md font-semibold"
              onClick={() => navigate(`/book/${branchId}/barber`)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
