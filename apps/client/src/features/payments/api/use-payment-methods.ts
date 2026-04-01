import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type SavedPaymentMethod = {
  id: string;
  type: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
};

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SavedPaymentMethod[]>>(
        "/payments/methods",
      );
      return res.data;
    },
  });
}

export function useSavePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tokenId: string;
      type?: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
      isDefault?: boolean;
    }) => {
      const res = await api.post<ApiResponse<SavedPaymentMethod>>(
        "/payments/methods",
        input,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiResponse<{ id: string }>>(
        `/payments/methods/${id}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });
}
