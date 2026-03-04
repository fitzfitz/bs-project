import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import type { ReceiptData } from '../types';

export function useReceipt(transactionId?: string) {
  return useQuery({
    queryKey: ['receipt', transactionId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReceiptData>>(
        `/transactions/${transactionId}/receipt`
      );
      return res.data;
    },
    enabled: !!transactionId,
  });
}
