import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type QueueEntry = {
  id: string;
  organizationId: string;
  branchId: string;
  staffProfileId: string | null;
  bookingId: string | null;
  customerId: string | null;
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "AT_CHECKOUT" | "PAID";
  source: "APP" | "WEB" | "WALK_IN";
  position: number;
  customerName: string | null;
  estimatedWait: number | null;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  staff: {
    id: string;
    user: { firstName: string; lastName: string };
  } | null;
  booking: {
    id: string;
    scheduledAt: string;
    note: string | null;
    totalDuration: number | null;
    items: {
      service: { name: string; durationMinutes: number; basePrice: number };
    }[];
  } | null;
  customer?: { firstName: string; lastName: string; phone?: string } | null;
  staffProfile?: { id: string; user: { firstName: string; lastName: string } } | null;
  services?: { service: { name: string; durationMinutes: number; basePrice: number } }[];
  scheduledFor?: string | null;
  estimatedDuration?: number;
  notes?: string | null;
  customerPhone?: string | null;
};

type ListParams = {
  branchId: string;
  date?: string;
  status?: string;
  staffProfileId?: string;
};

export function useQueue(params: ListParams) {
  const search = new URLSearchParams();
  search.set("branchId", params.branchId);
  if (params.date) search.set("date", params.date);
  if (params.status) search.set("status", params.status);
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  return useQuery({
    queryKey: ["queue", params],
    queryFn: () => api.get<ApiResponse<QueueEntry[]>>(`/queue?${search}`),
    enabled: !!params.branchId,
    refetchInterval: 30_000,
  });
}

export function useUpdateQueueStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<QueueEntry>>(`/queue/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["queue"] });
      const queries = qc.getQueriesData<ApiResponse<QueueEntry[]>>({
        queryKey: ["queue"],
      });
      const snapshots: [readonly unknown[], ApiResponse<QueueEntry[]> | undefined][] = [];
      for (const [key, data] of queries) {
        snapshots.push([key, data]);
        if (!data?.data) continue;
        qc.setQueryData<ApiResponse<QueueEntry[]>>(key, {
          ...data,
          data: data.data.map((e) =>
            e.id === id ? { ...e, status: status as QueueEntry["status"] } : e,
          ),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) qc.setQueryData(key, data);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useAssignStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffProfileId }: { id: string; staffProfileId: string }) =>
      api.post<ApiResponse<QueueEntry>>(`/queue/${id}/assign`, { staffProfileId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function usePostponeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes?: number }) =>
      api.post<ApiResponse<QueueEntry>>(`/queue/${id}/postpone`, { minutes: minutes ?? 10 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useCancelEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<QueueEntry>>(`/queue/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export type CreateEntryInput = {
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  staffProfileId?: string;
  serviceIds: string[];
  startTime: string;
  estimatedDuration: number;
  source?: "APP" | "WEB" | "WALK_IN";
  notes?: string;
};

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEntryInput) =>
      api.post<ApiResponse<QueueEntry>>("/queue", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}
