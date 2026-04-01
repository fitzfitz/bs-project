import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type OperatingHour = {
  id: string;
  branchId?: string;
  organizationId?: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export type SurgeRule = {
  id: string;
  branchId: string;
  organizationId: string;
  name: string | null;
  dayOfWeek: string;
  startHour: number;
  endHour: number;
  multiplier: number;
  isActive: boolean;
};

export type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isEmergencyClosed: boolean;
  tipDistribution?: string | null;
  maxDiscountPercent?: number | null;
  averageRating: number;
  totalReviews: number;
  organizationId: string;
  operatingHours: OperatingHour[];
  surgeRules: SurgeRule[];
  createdAt: string;
  updatedAt: string;
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
