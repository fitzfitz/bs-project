import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export function useMyWaitlist() {
  return useQuery({
    queryKey: ['my-waitlist'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<unknown>>('/waitlist/me');
      return res.data;
    },
  });
}

export function useJoinWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      branchId: string;
      preferredDate: string;
      preferredTimeSlot: string;
      serviceIds: string[];
      staffProfileId?: string;
    }) => {
      const res = await api.post<ApiResponse<unknown>>('/waitlist', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-waitlist'] });
    },
  });
}

export function useLeaveWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiResponse<unknown>>(`/waitlist/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-waitlist'] });
    },
  });
}
