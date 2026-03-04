import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useSessionStore } from '@/features/auth/store';
import type { BookingHistoryItem } from '../types';

export function useHistory() {
  const { user } = useSessionStore();
  return useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BookingHistoryItem[]>>('/queue/me');
      return res.data;
    },
    enabled: !!user,
  });
}
