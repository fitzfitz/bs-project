import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";
import {
  useBarbers,
  useCreateBarber,
  useDeleteBarber,
  useUpdateBarberStatus,
  useAssignBarberBranch,
  useUnassignBarberBranch,
  useResetCommission,
  useUpdateAvatar,
  type StaffProfile,
} from "@/features/barbers/api/use-barbers";
import { ImageUpload } from "@/components/ui/image-upload";
import { useUserSearch, type SearchUser } from "@/features/barbers/api/use-user-search";
import { useBranches } from "@/features/pos/api/use-branches";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const TIERS = ["JUNIOR", "SENIOR", "MASTER"] as const;
const STATUSES = ["AVAILABLE", "BUSY", "ON_BREAK", "RESERVED", "OFF_DUTY"] as const;
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  BUSY: "bg-yellow-100 text-yellow-800",
  ON_BREAK: "bg-blue-100 text-blue-800",
  RESERVED: "bg-purple-100 text-purple-800",
  OFF_DUTY: "bg-gray-100 text-gray-600",
};

export default function BarbersPage() {
  const { t } = useTranslation();
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const { data: branchesData } = useBranches();
  const branches = branchesData?.data ?? [];

  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<StaffProfile | null>(null);
  const [assignBranchId, setAssignBranchId] = useState("");

  const { data, isLoading } = useBarbers({
    branchId: selectedBranchId ?? undefined,
    tier: tierFilter || undefined,
    page,
  });
  const createBarber = useCreateBarber();
  const deleteBarber = useDeleteBarber();
  const updateStatus = useUpdateBarberStatus();
  const assignBranch = useAssignBarberBranch();
  const unassignBranch = useUnassignBarberBranch();
  const resetCommission = useResetCommission();
  const updateAvatar = useUpdateAvatar();

  const barbers = data?.data ?? [];
  const pagination = data?.pagination;

  const [formUserId, setFormUserId] = useState("");
  const [formTier, setFormTier] = useState<string>("JUNIOR");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const { data: userSearchData, isLoading: userSearchLoading } = useUserSearch(userSearchTerm);
  const searchUsers = userSearchData?.data ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectUser = (user: SearchUser) => {
    setFormUserId(user.id);
    setUserSearchTerm(`${user.firstName} ${user.lastName} (${user.email})`);
    setShowUserDropdown(false);
  };

  const handleCreate = async () => {
    if (!formUserId) return;
    await createBarber.mutateAsync({ userId: formUserId, tier: formTier });
    setFormUserId("");
    setUserSearchTerm("");
    setShowCreate(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("staff:title")}
        actions={(
          <>
            <BranchSelector />
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">All tiers</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="ml-auto rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground"
            >
              + Add Barber
            </button>
          </>
        )}
      />

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Branches</th>
                <th className="px-3 py-2 text-left font-medium">Commission</th>
                <th className="px-3 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {barbers.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No barbers found.</td></tr>
              ) : barbers.map((b: StaffProfile) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{b.user.firstName} {b.user.lastName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{b.tier}</span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={b.status}
                      onChange={(e) => updateStatus.mutate({ id: b.id, status: e.target.value })}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 ${STATUS_COLORS[b.status] ?? ""}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {b.branch?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {((b.commissionRate ?? 0) * 100).toFixed(0)}% ({b.commissionModel ?? "—"})
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBarber(b)}
                      className="text-primary text-xs hover:underline"
                    >
                      Manage
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Deactivate this barber?")) deleteBarber.mutate(b.id); }}
                      className="text-destructive text-xs hover:underline"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Prev</button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Barber</h2>
            <div className="space-y-3">
              <div ref={userDropdownRef} className="relative">
                <label className="block text-sm font-medium mb-1">User</label>
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    setFormUserId("");
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => userSearchTerm.length >= 2 && setShowUserDropdown(true)}
                  className="w-full rounded border px-3 py-1.5 text-sm"
                  placeholder="Search by name or email (min 2 chars)"
                />
                {showUserDropdown && userSearchTerm.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow-lg max-h-48 overflow-auto">
                    {userSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                    ) : searchUsers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                    ) : (
                      searchUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex flex-col"
                        >
                          <span className="font-medium">{u.firstName} {u.lastName}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tier</label>
                <select value={formTier} onChange={(e) => setFormTier(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm">
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!formUserId || createBarber.isPending}
                className="w-full rounded bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {createBarber.isPending ? "Creating..." : "Create Barber Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage modal -- branch assignments */}
      {selectedBarber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedBarber(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedBarber.user.firstName} {selectedBarber.user.lastName}</h2>
              <button type="button" onClick={() => setSelectedBarber(null)} className="text-lg text-muted-foreground">&times;</button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <ImageUpload
                  value={selectedBarber.user.avatar}
                  prefix="avatars"
                  entityId={selectedBarber.userId}
                  onUploaded={(url) => updateAvatar.mutate({ userId: selectedBarber.userId, avatar: url })}
                  onRemove={() => updateAvatar.mutate({ userId: selectedBarber.userId, avatar: null })}
                />
                <div>
                  <p className="font-medium">{selectedBarber.user.firstName} {selectedBarber.user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{selectedBarber.user.email}</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Current Branch</p>
                {selectedBarber.branch ? (
                  <div className="flex items-center justify-between rounded border px-3 py-1.5">
                    <span>{selectedBarber.branch.name}</span>
                    <button
                      type="button"
                      onClick={() => unassignBranch.mutate({ id: selectedBarber.id, branchId: selectedBarber.branch!.id })}
                      className="text-destructive text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not assigned to any branch.</p>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Assign to Branch</p>
                <div className="flex gap-2">
                  <select value={assignBranchId} onChange={(e) => setAssignBranchId(e.target.value)} className="flex-1 rounded border px-3 py-1.5">
                    <option value="">Select branch</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (assignBranchId) {
                        assignBranch.mutate({ id: selectedBarber.id, branchId: assignBranchId });
                        setAssignBranchId("");
                      }
                    }}
                    disabled={!assignBranchId || assignBranch.isPending}
                    className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">Details</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Reset commission rate to the org template for this tier?")) {
                        resetCommission.mutate(selectedBarber.userId);
                      }
                    }}
                    disabled={resetCommission.isPending}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {resetCommission.isPending ? "Resetting..." : "Reset to Template"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Tier</span><span>{selectedBarber.tier}</span>
                  <span className="text-muted-foreground">Commission</span><span>{((selectedBarber.commissionRate ?? 0) * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground">Model</span><span>{selectedBarber.commissionModel ?? "—"}</span>
                  <span className="text-muted-foreground">Base Salary</span><span>{(selectedBarber.baseSalary ?? 0).toLocaleString("id-ID")}</span>
                  <span className="text-muted-foreground">Active</span><span>{selectedBarber.user.isActive ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
