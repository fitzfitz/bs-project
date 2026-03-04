import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";

export type ReportType = "daily_revenue" | "service_popularity" | "staff_leaderboard" | "customer_visits" | "booking_source";

interface ReportData {
  type: ReportType;
  columns: string[];
  rows: Record<string, unknown>[];
  generatedAt: string;
}

export function useReport(params: { type: ReportType; branchId: string; dateFrom: string; dateTo: string }) {
  const search = new URLSearchParams();
  search.set("type", params.type);
  search.set("branchId", params.branchId);
  search.set("dateFrom", params.dateFrom);
  search.set("dateTo", params.dateTo);
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => api.get<ApiResponse<ReportData>>(`/reports/generate?${search}`),
    enabled: !!params.branchId,
  });
}

export function useExportCSV() {
  return useMutation({
    mutationFn: async (params: { type: ReportType; branchId: string; dateFrom: string; dateTo: string }) => {
      const search = new URLSearchParams();
      search.set("type", params.type);
      search.set("branchId", params.branchId);
      search.set("dateFrom", params.dateFrom);
      search.set("dateTo", params.dateTo);

      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";
      const token = useSessionStore.getState().accessToken;
      const res = await fetch(`${baseURL}/reports/export/csv?${search}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Export failed");
      const csv = await res.text();
      const filename = `${params.type}_${params.dateFrom}_${params.dateTo}.csv`;
      return { csv, filename };
    },
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
