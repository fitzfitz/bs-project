import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useAddTierSurcharge,
  useAddComboChild,
  useSetBranchOverride,
  type Service,
} from "../api/use-services";
import { useBranches } from "@/features/pos/api/use-branches";
import { useBranchStore } from "@/store/use-branch-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const serviceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  type: z.enum(["STANDARD", "COMBO", "ADD_ON"]),
  basePrice: z.number().positive("Price must be positive"),
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0),
  sortOrder: z.number().int(),
  isCommissionable: z.boolean(),
  loyaltyEligible: z.boolean(),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

const defaultFormValues: ServiceFormValues = {
  name: "",
  description: "",
  category: "",
  type: "STANDARD",
  basePrice: 50_000,
  durationMinutes: 30,
  bufferMinutes: 5,
  sortOrder: 0,
  isCommissionable: true,
  loyaltyEligible: true,
};

function serviceToForm(s: Service): ServiceFormValues {
  return {
    name: s.name,
    description: s.description ?? "",
    category: s.category,
    type: s.type,
    basePrice: s.basePrice,
    durationMinutes: s.durationMinutes,
    bufferMinutes: s.bufferMinutes,
    sortOrder: s.sortOrder,
    isCommissionable: s.isCommissionable,
    loyaltyEligible: s.loyaltyEligible,
  };
}

export function ServiceManager() {
  const org = useSessionStore((s) => s.user?.organization);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Service | null>(null);

  const listParams = useMemo(
    () => ({
      category: categoryFilter || undefined,
      type: typeFilter || undefined,
      isActive: activeFilter === "" ? undefined : activeFilter,
      page,
      limit: 50,
    }),
    [categoryFilter, typeFilter, activeFilter, page]
  );

  const { data, isLoading, isError, error, refetch } = useServices(listParams);
  const services = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination;

  const { data: branchesRes } = useBranches();
  const branches = branchesRes?.data ?? [];

  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const addTier = useAddTierSurcharge();
  const addCombo = useAddComboChild();
  const setOverride = useSetBranchOverride();

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) set.add(s.category);
    return Array.from(set).sort();
  }, [services]);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!editorOpen) return;
    if (editing) form.reset(serviceToForm(editing));
    else form.reset(defaultFormValues);
  }, [editorOpen, editing, form]);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setEditorOpen(true);
  }

  async function onSubmit(values: ServiceFormValues) {
    const payload = {
      ...values,
      description: values.description?.trim() || undefined,
    };
    if (editing) {
      await updateService.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createService.mutateAsync(payload);
    }
    setEditorOpen(false);
    setEditing(null);
  }

  const editorPending = createService.isPending || updateService.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 min-w-[160px]">
          <Label htmlFor="svc-cat">Category</Label>
          <NativeSelect
            id="svc-cat"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 min-w-[140px]">
          <Label htmlFor="svc-type">Type</Label>
          <NativeSelect
            id="svc-type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="STANDARD">Standard</option>
            <option value="COMBO">Combo</option>
            <option value="ADD_ON">Add-on</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5 min-w-[140px]">
          <Label htmlFor="svc-active">Status</Label>
          <NativeSelect
            id="svc-active"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </NativeSelect>
        </div>
        <Button type="button" className="sm:ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add service
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-2">
          <span>{(error as Error)?.message ?? "Failed to load services"}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </span>
                </TableCell>
              </TableRow>
            ) : services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No services match your filters.
                </TableCell>
              </TableRow>
            ) : (
              services.map((s) => (
                <ServiceTableRows
                  key={s.id}
                  service={s}
                  expanded={expanded.has(s.id)}
                  onToggle={() => toggleRow(s.id)}
                  onEdit={() => openEdit(s)}
                  onDeactivate={() => setDeactivateTarget(s)}
                  allServices={services}
                  branches={branches}
                  defaultBranchId={selectedBranchId}
                  addTier={addTier}
                  addCombo={addCombo}
                  setOverride={setOverride}
                  currency={org?.currency}
                  locale={org?.locale}
                  currencyLabel={org?.currency || "IDR"}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "Create service"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update catalog fields. Changes apply organization-wide."
                : "Add a new item to the service catalog."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Description</Label>
              <Input id="svc-desc" {...form.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-category">Category</Label>
                <Input id="svc-category" {...form.register("category")} />
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-ftype">Type</Label>
                <Controller
                  name="type"
                  control={form.control}
                  render={({ field }) => (
                    <NativeSelect id="svc-ftype" {...field}>
                      <option value="STANDARD">Standard</option>
                      <option value="COMBO">Combo</option>
                      <option value="ADD_ON">Add-on</option>
                    </NativeSelect>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Base price ({org?.currency || "IDR"})</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={1}
                  step={1}
                  {...form.register("basePrice", { valueAsNumber: true })}
                />
                {form.formState.errors.basePrice && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.basePrice.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-dur">Duration (min)</Label>
                <Input
                  id="svc-dur"
                  type="number"
                  min={1}
                  step={1}
                  {...form.register("durationMinutes", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-buf">Buffer (min)</Label>
                <Input
                  id="svc-buf"
                  type="number"
                  min={0}
                  step={1}
                  {...form.register("bufferMinutes", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-sort">Sort order</Label>
                <Input
                  id="svc-sort"
                  type="number"
                  step={1}
                  {...form.register("sortOrder", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  name="isCommissionable"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
                Commissionable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  name="loyaltyEligible"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
                Loyalty eligible
              </label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditorOpen(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editorPending}>
                {editorPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Deactivate service?</DialogTitle>
            <DialogDescription>
              {deactivateTarget
                ? `"${deactivateTarget.name}" will be hidden from active catalog. You can re-activate later from the API if needed.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteService.isPending}
              onClick={async () => {
                if (!deactivateTarget) return;
                await deleteService.mutateAsync(deactivateTarget.id);
                setDeactivateTarget(null);
              }}
            >
              {deleteService.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceTableRows({
  service: s,
  expanded,
  onToggle,
  onEdit,
  onDeactivate,
  allServices,
  branches,
  defaultBranchId,
  addTier,
  addCombo,
  setOverride,
  currency,
  locale,
  currencyLabel,
}: {
  service: Service;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  allServices: Service[];
  branches: { id: string; name: string }[];
  defaultBranchId: string | null;
  addTier: ReturnType<typeof useAddTierSurcharge>;
  addCombo: ReturnType<typeof useAddComboChild>;
  setOverride: ReturnType<typeof useSetBranchOverride>;
  currency?: string;
  locale?: string;
  currencyLabel: string;
}) {
  const [tier, setTier] = useState("JUNIOR");
  const [surcharge, setSurcharge] = useState("");
  const [comboChildId, setComboChildId] = useState("");
  const [ovBranch, setOvBranch] = useState(() => defaultBranchId ?? "");
  const [ovPrice, setOvPrice] = useState("");
  const [ovActive, setOvActive] = useState(true);

  const comboCandidates = useMemo(
    () =>
      allServices.filter(
        (x) => x.id !== s.id && x.type !== "COMBO" && x.isActive
      ),
    [allServices, s.id]
  );

  return (
    <>
      <TableRow className="group">
        <TableCell className="align-middle">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{s.name}</TableCell>
        <TableCell>{s.category}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {s.type}
          </Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(s.basePrice, currency, locale)}
        </TableCell>
        <TableCell className="text-right tabular-nums">{s.durationMinutes} min</TableCell>
        <TableCell>
          {s.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">Inactive</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            {s.isActive ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDeactivate}
                title="Deactivate"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="p-4">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2 rounded-lg border border-border/80 bg-background p-3">
                <h4 className="text-sm font-semibold text-foreground">Tier surcharges</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {s.tierSurcharges.length === 0 ? (
                    <li>None yet</li>
                  ) : (
                    s.tierSurcharges.map((t) => (
                      <li key={t.id}>
                        {t.tier}: +{formatCurrency(t.surcharge, currency, locale)}
                      </li>
                    ))
                  )}
                </ul>
                <div className="flex flex-wrap gap-2 items-end pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tier</Label>
                    <NativeSelect
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      className="h-9"
                    >
                      <option value="JUNIOR">Junior</option>
                      <option value="SENIOR">Senior</option>
                      <option value="MASTER">Master</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[100px]">
                    <Label className="text-xs">Surcharge ({currencyLabel})</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={surcharge}
                      onChange={(e) => setSurcharge(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={addTier.isPending || surcharge === ""}
                    onClick={async () => {
                      const n = Number(surcharge);
                      if (Number.isNaN(n) || n < 0) return;
                      await addTier.mutateAsync({ id: s.id, tier, surcharge: n });
                      setSurcharge("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/80 bg-background p-3">
                <h4 className="text-sm font-semibold text-foreground">Branch overrides</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {s.branchOverrides.length === 0 ? (
                    <li>None yet</li>
                  ) : (
                    s.branchOverrides.map((o) => {
                      const bn =
                        branches.find((b) => b.id === o.branchId)?.name ?? o.branchId;
                      return (
                        <li key={o.id}>
                          {bn} —{" "}
                          {o.overridePrice != null
                            ? formatCurrency(o.overridePrice, currency, locale)
                            : "—"}{" "}
                          {o.isActive ? "(on)" : "(off)"}
                        </li>
                      );
                    })
                  )}
                </ul>
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Branch</Label>
                    <NativeSelect
                      value={ovBranch}
                      onChange={(e) => setOvBranch(e.target.value)}
                      className="h-9"
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Override price ({currencyLabel}, empty = none)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      step={1000}
                      value={ovPrice}
                      onChange={(e) => setOvPrice(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={ovActive}
                      onChange={(e) => setOvActive(e.target.checked)}
                    />
                    Active
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={setOverride.isPending || !ovBranch}
                    onClick={async () => {
                      const raw = ovPrice.trim();
                      const overridePrice =
                        raw === "" ? null : Number(raw);
                      if (overridePrice !== null && (Number.isNaN(overridePrice) || overridePrice <= 0))
                        return;
                      await setOverride.mutateAsync({
                        id: s.id,
                        branchId: ovBranch,
                        overridePrice,
                        isActive: ovActive,
                      });
                      setOvPrice("");
                    }}
                  >
                    Save override
                  </Button>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/80 bg-background p-3">
                <h4 className="text-sm font-semibold text-foreground">Combo children</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {s.type !== "COMBO" ? (
                    <li>Not a combo service</li>
                  ) : s.comboChildren.length === 0 ? (
                    <li>No bundled services</li>
                  ) : (
                    s.comboChildren.map((c) => (
                      <li key={c.id}>{c.childService.name}</li>
                    ))
                  )}
                </ul>
                {s.type === "COMBO" ? (
                  <div className="flex flex-wrap gap-2 items-end pt-2">
                    <div className="space-y-1 flex-1 min-w-[140px]">
                      <Label className="text-xs">Add service</Label>
                      <NativeSelect
                        value={comboChildId}
                        onChange={(e) => setComboChildId(e.target.value)}
                        className="h-9"
                      >
                        <option value="">Select</option>
                        {comboCandidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={addCombo.isPending || !comboChildId}
                      onClick={async () => {
                        await addCombo.mutateAsync({
                          id: s.id,
                          childServiceId: comboChildId,
                        });
                        setComboChildId("");
                      }}
                    >
                      Add to combo
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
