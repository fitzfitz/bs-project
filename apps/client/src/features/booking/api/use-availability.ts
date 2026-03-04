import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type TimeSlot = { time: string; available: boolean };

export function useAvailability(branchId?: string, date?: string, staffProfileId?: string) {
  const search = new URLSearchParams();
  if (branchId) search.set("branchId", branchId);
  if (date) search.set("date", date);
  if (staffProfileId) search.set("staffProfileId", staffProfileId);

  return useQuery({
    queryKey: ['availability', branchId, date, staffProfileId],
    queryFn: () => api.get<ApiResponse<TimeSlot[]>>(`/queue/availability?${search}`),
    enabled: !!branchId && !!date,
  });
}
