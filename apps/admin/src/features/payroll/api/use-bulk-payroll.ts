import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBulkApprovePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; note?: string }) =>
      api.post<{ approved: number }>("/payroll/bulk-approve", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll"] }),
  });
}

export function useBulkDisbursePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[] }) =>
      api.post<{ disbursed: number }>("/payroll/bulk-disburse", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll"] }),
  });
}
