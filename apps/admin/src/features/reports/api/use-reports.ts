import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";

export type ReportType =
  | "daily_revenue"
  | "service_popularity"
  | "barber_leaderboard"
  | "staff_leaderboard"
  | "customer_visits"
  | "booking_source";

export interface ReportData {
  type: ReportType;
  columns: string[];
  rows: Record<string, unknown>[];
  generatedAt: string;
}

export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  id: string;
  type: ReportType;
  frequency: ReportScheduleFrequency;
  branchId: string | null;
  recipients: string[];
  active: boolean;
  lastSent: string | null;
  nextRun: string | null;
}

export interface CreateReportScheduleInput {
  type: ReportType;
  frequency: ReportScheduleFrequency;
  branchId?: string | null;
  recipients: string[];
  active?: boolean;
}

export type UpdateReportScheduleInput = Partial<
  Pick<ReportSchedule, "type" | "frequency" | "branchId" | "recipients" | "active">
>;

export interface ReportTemplate {
  id: string;
  name: string;
  type: ReportType;
  branchId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface CreateReportTemplateInput {
  name: string;
  type: ReportType;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
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

function buildExportSearchParams(params: {
  type: ReportType;
  branchId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const search = new URLSearchParams();
  search.set("type", params.type);
  search.set("branchId", params.branchId);
  search.set("dateFrom", params.dateFrom);
  search.set("dateTo", params.dateTo);
  return search;
}

export function useExportCSV() {
  return useMutation({
    mutationFn: async (params: { type: ReportType; branchId: string; dateFrom: string; dateTo: string }) => {
      const search = buildExportSearchParams(params);

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

export function useExportPDF() {
  return useMutation({
    mutationFn: async (params: { type: ReportType; branchId: string; dateFrom: string; dateTo: string }) => {
      const search = buildExportSearchParams(params);

      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";
      const token = useSessionStore.getState().accessToken;
      const res = await fetch(`${baseURL}/reports/export/pdf?${search}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Export failed");
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/pdf" });
      const filename = `${params.type}_${params.dateFrom}_${params.dateTo}.pdf`;
      return { blob, filename };
    },
    onSuccess: (data) => {
      const url = URL.createObjectURL(data.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ["report-schedules"],
    queryFn: () => api.get<ApiResponse<ReportSchedule[]>>("/reports/schedules"),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReportScheduleInput) =>
      api.post<ApiResponse<ReportSchedule>>("/reports/schedules", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReportScheduleInput }) =>
      api.patch<ApiResponse<ReportSchedule>>(`/reports/schedules/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<{ ok: boolean }>>(`/reports/schedules/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["report-templates"],
    queryFn: () => api.get<ApiResponse<ReportTemplate[]>>("/reports/templates"),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReportTemplateInput) =>
      api.post<ApiResponse<ReportTemplate>>("/reports/templates", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<{ ok: boolean }>>(`/reports/templates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-templates"] });
    },
  });
}
