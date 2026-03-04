import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type CashDrawerEntry = {
  id: string;
  sessionId: string;
  type: "SALE" | "REFUND" | "ADJUSTMENT" | "FLOAT";
  amount: number;
  reference: string | null;
  createdAt: string;
};

export type CashDrawerSession = {
  id: string;
  branchId: string;
  openedById: string;
  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number | null;
  discrepancy: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  branch?: { id: string; name: string };
  openedBy?: { id: string; firstName: string; lastName: string };
  entries?: CashDrawerEntry[];
};

export function useCurrentSession(branchId: string | null) {
  return useQuery({
    queryKey: ["cash-drawer", "current", branchId],
    queryFn: () =>
      api.get<ApiResponse<CashDrawerSession | null>>(
        `/cash-drawer/current?branchId=${branchId}`
      ),
    enabled: !!branchId,
  });
}

export function useOpenSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId: string; openingBalance: number }) =>
      api.post<ApiResponse<CashDrawerSession>>("/cash-drawer/open", input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["cash-drawer", "current", variables.branchId] });
    },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      closingBalance: number;
      notes?: string;
    }) => api.post<ApiResponse<CashDrawerSession>>("/cash-drawer/close", input),
    onSuccess: (data) => {
      const branchId = data?.data?.branchId;
      if (branchId) {
        qc.invalidateQueries({ queryKey: ["cash-drawer", "current", branchId] });
      }
    },
  });
}

export function useAddEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      type: "SALE" | "REFUND" | "ADJUSTMENT" | "FLOAT";
      amount: number;
      reference?: string;
    }) => api.post<ApiResponse<CashDrawerEntry>>("/cash-drawer/entry", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-drawer"] });
    },
  });
}
