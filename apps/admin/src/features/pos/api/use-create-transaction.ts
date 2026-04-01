import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type Item = { serviceId?: string; productId?: string; name: string; quantity: number; unitPrice: number; discount: number; isAddOn: boolean };
type CreatePayload = {
  branchId: string;
  queueEntryId?: string;
  staffProfileId?: string;
  customerId?: string;
  items: Item[];
  tipAmount: number;
  discountAmount: number;
  promoCode?: string;
  loyaltyPointsUsed?: number;
  clientUuid?: string;
};

export function useCreateTransaction() {
  return useMutation({
    mutationFn: (payload: CreatePayload) =>
      api.post<ApiResponse<{ id: string; totalDue: number }>>("/transactions", payload),
  });
}
