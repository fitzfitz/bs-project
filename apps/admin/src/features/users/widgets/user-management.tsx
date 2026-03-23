import { useState } from "react";
import {
  useUsers,
  useUpdateUserRole,
  useDeactivateUser,
  useReactivateUser,
  useAssignUserBranch,
  useRemoveUserBranch,
  type UserRow,
} from "../api/use-users";
import { useBranches } from "@/features/pos/api/use-branches";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserX,
  UserCheck,
  Building2,
  X,
} from "lucide-react";

const SCOPE_COLORS: Record<string, string> = {
  HQ: "bg-red-100 text-red-700",
  BRANCH: "bg-blue-100 text-blue-700",
  CUSTOMER: "bg-slate-100 text-slate-700",
};

function buildRoleOptions(users: UserRow[], selectedUser?: UserRow | null, includeAll = true): { value: string; label: string }[] {
  const seen = new Set<string>();
  const opts: { value: string; label: string }[] = includeAll ? [{ value: "", label: "All Roles" }] : [];
  for (const u of users) {
    if (u.tenantRoleId && !seen.has(u.tenantRoleId)) {
      seen.add(u.tenantRoleId);
      opts.push({ value: u.tenantRoleId, label: u.tenantRole?.name ?? u.tenantRoleId });
    }
  }
  if (selectedUser?.tenantRoleId && !seen.has(selectedUser.tenantRoleId)) {
    opts.push({ value: selectedUser.tenantRoleId, label: selectedUser.tenantRole?.name ?? selectedUser.tenantRoleId });
  }
  return opts;
}

export function UserManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newBranchId, setNewBranchId] = useState("");

  const { data, isLoading } = useUsers({
    search: search || undefined,
    tenantRoleId: roleFilter || undefined,
    isActive: activeFilter,
    page,
    limit: 20,
  });

  const updateRole = useUpdateUserRole();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const assignBranch = useAssignUserBranch();
  const removeBranch = useRemoveUserBranch();

  const users = data?.data ?? [];
  const pagination = data?.pagination;

  function openRoleDialog(user: UserRow) {
    setSelectedUser(user);
    setNewRole(user.tenantRoleId);
    setShowRoleDialog(true);
  }

  function openBranchDialog(user: UserRow) {
    setSelectedUser(user);
    setNewBranchId("");
    setShowBranchDialog(true);
  }

  function handleRoleUpdate() {
    if (!selectedUser || !newRole) return;
    updateRole.mutate(
      { id: selectedUser.id, tenantRoleId: newRole },
      {
        onSuccess: () => setShowRoleDialog(false),
      }
    );
  }

  function handleAssignBranch() {
    if (!selectedUser || !newBranchId) return;
    assignBranch.mutate(
      { id: selectedUser.id, branchId: newBranchId },
      {
        onSuccess: () => setShowBranchDialog(false),
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {buildRoleOptions(users).map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={activeFilter ?? ""}
          onChange={(e) => {
            setActiveFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  User
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Branch(es)
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SCOPE_COLORS[u.tenantRole?.scope ?? ""] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {u.tenantRole?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.branch ? (
                          [u.branch].map((br) => (
                            <span
                              key={br.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600"
                            >
                              {br.name}
                              <button
                                onClick={() =>
                                  removeBranch.mutate({
                                    id: u.id,
                                    branchId: br.id,
                                  })
                                }
                                className="hover:text-red-500 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">
                            No branch
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openRoleDialog(u)}
                          title="Change role"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition-colors"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openBranchDialog(u)}
                          title="Assign branch"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition-colors"
                        >
                          <Building2 className="h-4 w-4" />
                        </button>
                        {u.isActive ? (
                          <button
                            onClick={() => deactivate.mutate(u.id)}
                            title="Deactivate"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivate.mutate(u.id)}
                            title="Reactivate"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-slate-500 hover:text-green-600 transition-colors"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {pagination.total} users total
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-600">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Change Dialog */}
      {showRoleDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">
              Change Role
            </h3>
            <p className="text-sm text-slate-500">
              Update role for{" "}
              <span className="font-medium text-slate-700">
                {selectedUser.firstName} {selectedUser.lastName}
              </span>
            </p>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {buildRoleOptions(users, selectedUser, false).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {updateRole.error && (
              <p className="text-xs text-red-600">
                {(updateRole.error as Error).message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRoleDialog(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={
                  updateRole.isPending || newRole === selectedUser.tenantRoleId
                }
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {updateRole.isPending ? "Saving..." : "Update Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Assignment Dialog */}
      {showBranchDialog && selectedUser && (
        <BranchAssignDialog
          user={selectedUser}
          branchId={newBranchId}
          setBranchId={setNewBranchId}
          onAssign={handleAssignBranch}
          isPending={assignBranch.isPending}
          error={assignBranch.error}
          onClose={() => setShowBranchDialog(false)}
        />
      )}
    </div>
  );
}

function BranchAssignDialog({
  user,
  branchId,
  setBranchId,
  onAssign,
  isPending,
  error,
  onClose,
}: {
  user: UserRow;
  branchId: string;
  setBranchId: (v: string) => void;
  onAssign: () => void;
  isPending: boolean;
  error: Error | null;
  onClose: () => void;
}) {
  const { data: branchesData } = useBranches();
  const branches = branchesData?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Assign Branch
        </h3>
        <p className="text-sm text-slate-500">
          Assign{" "}
          <span className="font-medium text-slate-700">
            {user.firstName} {user.lastName}
          </span>{" "}
          to a branch
        </p>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          Current:{" "}
          {user.branch?.name ?? "None"}
        </p>
        {error && (
          <p className="text-xs text-red-600">{error.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onAssign}
            disabled={isPending || !branchId}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
