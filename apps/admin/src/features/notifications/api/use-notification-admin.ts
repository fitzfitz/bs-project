import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data: unknown;
  read: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type NotificationStats = {
  totalSent: number;
  totalUnread: number;
  last30Days: number;
  byType: Array<{ type: string; count: number }>;
};

export type AdminListParams = {
  page?: number;
  limit?: number;
  userId?: string;
  type?: string;
  read?: boolean;
  from?: string;
  to?: string;
};

export type NotificationAdminListResponse = ApiResponse<NotificationItem[]>;
export type NotificationStatsResponse = ApiResponse<NotificationStats>;
export type TestSendResponse = ApiResponse<{ notificationId: string; pushSent: boolean }>;

export function useNotificationAdminList(params: AdminListParams) {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  search.set("limit", String(params.limit ?? 20));
  if (params.userId) search.set("userId", params.userId);
  if (params.type) search.set("type", params.type);
  if (params.read !== undefined) search.set("read", String(params.read));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);

  return useQuery({
    queryKey: ["notifications-admin", params],
    queryFn: () =>
      api.get<NotificationAdminListResponse>(`/notifications/admin?${search}`),
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: ["notifications-admin", "stats"],
    queryFn: () =>
      api.get<NotificationStatsResponse>("/notifications/admin/stats"),
  });
}

export function useTestSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; title: string; body: string; type?: string }) =>
      api.post<TestSendResponse>("/notifications/admin/test-send", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-admin"] });
    },
  });
}
