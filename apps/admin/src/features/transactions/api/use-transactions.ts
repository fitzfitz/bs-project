import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type TransactionItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type Payment = {
  id: string;
  method: string;
  amount: number;
  reference?: string | null;
};

export type TransactionRow = {
  id: string;
  branchId: string;
  status: "PENDING" | "COMPLETED" | "VOIDED" | "REFUNDED";
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  netAmount: number;
  totalDue: number;
  customerId: string | null;
  staffProfileId: string | null;
  createdAt: string;
  branch?: { name: string };
  customer?: { firstName: string; lastName: string } | null;
  staffProfile?: { user: { firstName: string; lastName: string } } | null;
  items?: TransactionItem[];
  payments?: Payment[];
};

type ListParams = {
  branchId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export function useTransactions(params: ListParams) {
  const search = new URLSearchParams();
  search.set("branchId", params.branchId);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => api.get<ApiResponse<TransactionRow[]>>(`/transactions?${search}`),
    enabled: !!params.branchId,
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: () => api.get<ApiResponse<TransactionRow>>(`/transactions/${id}`),
    enabled: !!id,
  });
}

export function useVoidTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ApiResponse<TransactionRow>>(`/transactions/${id}/void`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
