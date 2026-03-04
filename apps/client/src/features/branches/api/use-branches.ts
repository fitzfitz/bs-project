import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  phone: string | null;
  operatingHours: string | null;
  averageRating: number;
  totalReviews: number;
  isEmergencyClosed?: boolean;
};

export function useBranches(search?: string) {
  return useQuery({
    queryKey: ['branches', search ?? ''],
    queryFn: async () => {
      const query = search ? `?city=${encodeURIComponent(search)}` : '';
      const res = await api.get<ApiResponse<Branch[]>>(`/branches${query}`);
      return res.data;
    },
  });
}
