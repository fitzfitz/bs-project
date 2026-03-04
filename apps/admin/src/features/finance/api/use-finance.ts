import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type PLSummary = {
  period: { from: string; to: string };
  revenue: {
    serviceRevenue: number;
    productRevenue: number;
    tipsCollected: number;
    totalRevenue: number;
  };
  costs: {
    totalCommissions: number;
    totalPayroll: number;
    inventoryCOGS: number;
    totalCosts: number;
  };
  grossProfit: number;
  margins: { grossMarginPercent: number };
  taxes: { ppnCollected: number };
  discountsGiven: number;
  voidsTotal: number;
};

export function usePLSummary(opts: { dateFrom: string; dateTo: string; branchId?: string }) {
  const params = new URLSearchParams({ dateFrom: opts.dateFrom, dateTo: opts.dateTo });
  if (opts.branchId) params.set("branchId", opts.branchId);

  return useQuery({
    queryKey: ["finance-pl", opts],
    queryFn: () => api.get<ApiResponse<PLSummary>>(`/finance/pl?${params}`),
  });
}

export function useVoidDiscountAudit(opts: { branchId: string; dateFrom: string; dateTo: string }) {
  const params = new URLSearchParams(opts);

  return useQuery({
    queryKey: ["finance-void-discount", opts],
    queryFn: () => api.get<ApiResponse<unknown>>(`/finance/void-discount-audit?${params}`),
    enabled: !!opts.branchId,
  });
}

export function useTaxSummary(opts: { dateFrom: string; dateTo: string; branchId?: string }) {
  const params = new URLSearchParams({ dateFrom: opts.dateFrom, dateTo: opts.dateTo });
  if (opts.branchId) params.set("branchId", opts.branchId);

  return useQuery({
    queryKey: ["finance-tax", opts],
    queryFn: () => api.get<ApiResponse<unknown>>(`/finance/tax-summary?${params}`),
  });
}
