import { useMemo, useState, type ComponentProps } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  useCrmCustomer,
  useCrmCustomers,
  useCrmSegments,
  useRecomputeCrmSegments,
  type CustomerInsights,
  type CrmCustomersParams,
} from "../api/use-crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const SEGMENT_ALL = "__all__";

function tierBadgeVariant(
  tier: string
): ComponentProps<typeof Badge>["variant"] {
  const t = tier.toUpperCase();
  if (t === "GOLD" || t === "PLATINUM") return "default";
  if (t === "SILVER") return "secondary";
  return "outline";
}

function CustomerDetailBody({
  row,
  currency,
  locale,
}: {
  row: CustomerInsights;
  currency?: string;
  locale?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Email
        </p>
        <p className="text-sm">{row.email || "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Segment
        </p>
        <p className="text-sm">{row.segment ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total visits
        </p>
        <p className="text-sm font-medium tabular-nums">{row.totalVisits}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total spend
        </p>
        <p className="text-sm font-medium tabular-nums">
          {formatCurrency(row.totalSpend, currency, locale)}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Average spend
        </p>
        <p className="text-sm font-medium tabular-nums">
          {formatCurrency(row.averageSpend, currency, locale)}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Days since last visit
        </p>
        <p className="text-sm tabular-nums">
          {row.daysSinceLastVisit === null ? "—" : `${row.daysSinceLastVisit} days`}
        </p>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Last visit
        </p>
        <p className="text-sm">
          {row.lastVisitAt
            ? new Date(row.lastVisitAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Favorite services
        </p>
        {row.favoriteServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {row.favoriteServices.map((s) => (
              <Badge key={s} variant="outline" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CrmDashboard({ branchId }: { branchId: string }) {
  const org = useSessionStore((s) => s.user?.organization);
  const [sortBy, setSortBy] = useState<CrmCustomersParams["sortBy"]>("recency");
  const [segmentFilter, setSegmentFilter] = useState<string>(SEGMENT_ALL);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recomputeNote, setRecomputeNote] = useState<string | null>(null);

  const listParams = useMemo(
    (): CrmCustomersParams => ({
      sortBy,
      page,
      limit: 20,
      ...(segmentFilter !== SEGMENT_ALL ? { segment: segmentFilter } : {}),
    }),
    [sortBy, page, segmentFilter]
  );

  const customersQuery = useCrmCustomers(branchId, listParams);
  const segmentsQuery = useCrmSegments(branchId);
  const detailQuery = useCrmCustomer(dialogOpen ? selectedId : null, branchId);
  const recompute = useRecomputeCrmSegments();

  const rows = useMemo(
    () => customersQuery.data?.data ?? [],
    [customersQuery.data?.data]
  );
  const pagination = customersQuery.data?.pagination;
  const segments = segmentsQuery.data?.data ?? [];

  const selectedRow =
    rows.find((r) => r.customerId === selectedId) ?? null;

  const displayInsight =
    detailQuery.data?.data ?? selectedRow ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by</span>
          {(
            [
              ["recency", "Recency"],
              ["spend", "Spend"],
              ["visits", "Visits"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={sortBy === key ? "default" : "outline"}
              onClick={() => {
                setSortBy(key);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={segmentFilter}
            onValueChange={(v: string) => {
              setSegmentFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[220px]" size="default">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEGMENT_ALL}>All segments</SelectItem>
              {segments.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={recompute.isPending}
            onClick={() => {
              setRecomputeNote(null);
              recompute.mutate(branchId, {
                onSuccess: (res) => {
                  const d = res.data;
                  setRecomputeNote(
                    `Updated ${d.segmentsProcessed} segments · ${d.totalAssigned} assignments`
                  );
                },
              });
            }}
          >
            {recompute.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Recompute segments
          </Button>
        </div>
      </div>

      {recomputeNote && (
        <p className="text-sm text-muted-foreground">{recomputeNote}</p>
      )}
      {recompute.isError && (
        <p className="text-sm text-destructive">
          {(recompute.error as Error)?.message ?? "Recompute failed"}
        </p>
      )}

      <Card className="overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30 py-4">
          <CardTitle className="text-base">Customers</CardTitle>
          <CardDescription>
            Click a row for full insights. Data is scoped to this branch.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {customersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading customers…
            </div>
          ) : customersQuery.isError ? (
            <div className="px-6 py-12 text-center text-sm text-destructive">
              {(customersQuery.error as Error)?.message ?? "Failed to load customers"}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No customers match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Days idle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.customerId}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(row.customerId);
                      setDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">{row.customerName}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {row.email || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.totalVisits}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(row.totalSpend, org?.currency, org?.locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tierBadgeVariant(row.loyaltyTier)}>
                        {row.loyaltyTier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.segment ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.daysSinceLastVisit ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.total} customers
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
                onClick={() =>
                  setPage((p) =>
                    pagination ? Math.min(pagination.totalPages, p + 1) : p + 1
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Segments</h2>
        {segmentsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading segments…
          </div>
        ) : segmentsQuery.isError ? (
          <p className="text-sm text-destructive">
            {(segmentsQuery.error as Error)?.message ?? "Failed to load segments"}
          </p>
        ) : segments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No segments for this branch.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {segments.map((s) => (
              <Card key={s.id} className="py-4 shadow-sm">
                <CardHeader className="gap-1 px-4 pb-2 pt-0">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription>
                    {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pt-0">
                  <Badge variant={s.isAutomatic ? "secondary" : "outline"}>
                    {s.isAutomatic ? "Automatic" : "Manual"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {displayInsight?.customerName ?? "Customer"}
            </DialogTitle>
          </DialogHeader>
          {detailQuery.isFetching && !displayInsight ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : displayInsight ? (
            <CustomerDetailBody
              row={displayInsight}
              currency={org?.currency}
              locale={org?.locale}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
