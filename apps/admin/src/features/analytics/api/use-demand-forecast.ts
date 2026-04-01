import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type ForecastItem = {
  date: string;
  predictedTransactions: number;
  predictedRevenue: number;
  confidenceLow: number;
  confidenceHigh: number;
  dayOfWeek: number;
  isHoliday: boolean;
};

export type ForecastResponse = {
  forecasts: ForecastItem[];
  accuracy: { mape: number };
};

export function useDemandForecast(branchId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["demand-forecast", branchId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: branchId! });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await api.get<ApiResponse<ForecastResponse>>(`/analytics/demand-forecast?${params}`);
      return res.data;
    },
    enabled: !!branchId,
  });
}

export function useComputeForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId?: string) =>
      api.post<ApiResponse<unknown>>("/analytics/demand-forecast/compute", { branchId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demand-forecast"] }),
  });
}
