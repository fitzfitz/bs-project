import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: string;
};

type NotificationListResponse = ApiResponse<NotificationItem[]> & {
  pagination: PaginationResponse;
};

export function useNotificationList(page = 1) {
  return useQuery({
    queryKey: ["notifications", page],
    queryFn: async () => {
      const res = await api.get<NotificationListResponse>(
        `/notifications?page=${page}&limit=20`
      );
      return res;
    },
  });
}

export function useUnreadCount() {
  const hasToken = useSessionStore((s) => !!s.accessToken);
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ count: number }>>(
        "/notifications/unread-count"
      );
      return res.data;
    },
    refetchInterval: 30_000,
    enabled: hasToken,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<ApiResponse<{ id: string; read: boolean }>>(
        `/notifications/${id}/read`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ updated: number }>>(
        "/notifications/mark-all-read"
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });
}
