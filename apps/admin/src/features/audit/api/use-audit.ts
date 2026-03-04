import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  tenantRole?: { name: string; scope: string } | null;
  branchId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; tenantRole?: { name: string; scope: string } } | null;
  branch: { id: string; name: string } | null;
};

export type AnomalyFlag = {
  id: string;
  branchId: string;
  userId: string | null;
  type: string;
  severity: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  branch: { id: string; name: string };
  user: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type AnomalyStats = {
  total: number;
  unresolved: number;
  bySeverity: { severity: string; count: number }[];
  byType: { type: string; count: number }[];
};

type LogParams = {
  branchId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

type AnomalyParams = {
  branchId?: string;
  type?: string;
  severity?: string;
  isResolved?: string;
  page?: number;
  limit?: number;
};

export function useAuditLogs(params: LogParams = {}) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.userId) search.set("userId", params.userId);
  if (params.action) search.set("action", params.action);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () =>
      api.get<ApiResponse<AuditLogEntry[]> & { pagination: PaginationResponse }>(
        `/audit/logs?${search}`
      ),
  });
}

export function useAnomalies(params: AnomalyParams = {}) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.type) search.set("type", params.type);
  if (params.severity) search.set("severity", params.severity);
  if (params.isResolved !== undefined) search.set("isResolved", params.isResolved);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["anomalies", params],
    queryFn: () =>
      api.get<ApiResponse<AnomalyFlag[]> & { pagination: PaginationResponse }>(
        `/audit/anomalies?${search}`
      ),
  });
}

export function useAnomalyStats(branchId?: string) {
  return useQuery({
    queryKey: ["anomaly-stats", branchId],
    queryFn: () => {
      const qs = branchId ? `?branchId=${branchId}` : "";
      return api.get<ApiResponse<AnomalyStats>>(`/audit/anomalies/stats${qs}`);
    },
  });
}

export function useResolveAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.patch<ApiResponse<AnomalyFlag>>(`/audit/anomalies/${id}/resolve`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anomalies"] });
      qc.invalidateQueries({ queryKey: ["anomaly-stats"] });
    },
  });
}
