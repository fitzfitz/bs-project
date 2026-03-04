import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type BranchDetail = {
  id: string;
  name: string;
};

export function useBranch(branchId?: string) {
  return useQuery({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BranchDetail>>(`/branches/${branchId}`);
      return res.data;
    },
    enabled: !!branchId,
  });
}
