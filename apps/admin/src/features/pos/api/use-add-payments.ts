import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type Payment = { method: string; amount: number; reference?: string };
type AddPaymentsPayload = { payments: Payment[] };

export function useAddPayments() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AddPaymentsPayload }) =>
      api.post<ApiResponse<unknown>>(`/transactions/${id}/pay`, payload),
  });
}
