import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  tenantRoleId: string;
  tenantRole?: { name: string; scope: string } | null;
  isActive: boolean;
  isCustomer: boolean;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  createdAt: string;
  staffProfile?: { id: string; tier: string } | null;
};

export type UserDetail = UserRow & {
  updatedAt: string;
  staffProfile?: { id: string; tier: string; bio: string | null } | null;
  customerMembership?: { id: string; pointsBalance: number; tier: string } | null;
};

type ListParams = {
  /** Filters by tenant role name (matches API `listUsersQuery.role`). */
  role?: string;
  branchId?: string;
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export function useUsers(params: ListParams = {}) {
  const search = new URLSearchParams();
  if (params.role) search.set("role", params.role);
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.search) search.set("search", params.search);
  if (params.isActive !== undefined) search.set("isActive", params.isActive);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["users", params],
    queryFn: () =>
      api.get<ApiResponse<UserRow[]> & { pagination: PaginationResponse }>(
        `/users?${search}`
      ),
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get<ApiResponse<UserDetail>>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tenantRoleId }: { id: string; tenantRoleId: string }) =>
      api.patch<ApiResponse<UserRow>>(`/users/${id}/role`, { tenantRoleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useAssignUserBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      branchId,
    }: {
      id: string;
      branchId: string;
    }) =>
      api.post<ApiResponse<unknown>>(`/users/${id}/assign-branch`, {
        branchId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useRemoveUserBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      api.delete<ApiResponse<unknown>>(
        `/users/${id}/assign-branch/${branchId}`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<UserRow>>(`/users/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<UserRow>>(`/users/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
