import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useSendCampaign,
  type Campaign,
} from "../api/use-campaigns";
import { useBranchStore } from "@/store/use-branch-store";
import { useSessionStore, hasPermission } from "@/features/auth/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["EMAIL", "PUSH", "SMS", "IN_APP"]),
  description: z.string().max(500),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

const TYPE_OPTIONS: { value: Campaign["type"]; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "PUSH", label: "Push" },
  { value: "SMS", label: "SMS" },
  { value: "IN_APP", label: "In-app" },
];

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "SENT", label: "Sent" },
  { value: "CANCELLED", label: "Cancelled" },
];

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatStartsAt(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const styles: Record<Campaign["status"], string> = {
    DRAFT: "border-transparent bg-muted text-muted-foreground",
    SCHEDULED: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    SENT: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    CANCELLED: "border-transparent bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  };
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status])}>
      {status.toLowerCase().replace("_", " ")}
    </Badge>
  );
}

export function CampaignManager() {
  const permissions = useSessionStore((s) => s.user?.permissions);
  const canDelete = hasPermission(permissions, "CAMPAIGNS", "canDelete");
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const [sendTarget, setSendTarget] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [sendFlash, setSendFlash] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      branchId: selectedBranchId ?? undefined,
      status: (statusFilter || undefined) as Campaign["status"] | undefined,
      page,
      limit: 20,
    }),
    [selectedBranchId, statusFilter, page]
  );

  const { data, isLoading, isError, error } = useCampaigns(listParams);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const sendCampaign = useSendCampaign();

  const campaigns = data?.data ?? [];
  const pagination = data?.pagination;

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      type: "EMAIL",
      description: "",
      startsAt: "",
      endsAt: "",
    },
  });

  useEffect(() => {
    if (!editorOpen) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type,
        description: editing.description ?? "",
        startsAt: toLocalDatetimeValue(editing.startsAt),
        endsAt: editing.endsAt ? toLocalDatetimeValue(editing.endsAt) : "",
      });
    } else {
      form.reset({
        name: "",
        type: "EMAIL",
        description: "",
        startsAt: toLocalDatetimeValue(new Date().toISOString()),
        endsAt: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog target changes only
  }, [editorOpen, editing]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setEditorOpen(true);
  }

  async function onSubmit(values: CampaignFormValues) {
    const startsAt = new Date(values.startsAt).toISOString();
    const endsIso = values.endsAt?.trim()
      ? new Date(values.endsAt).toISOString()
      : undefined;

    if (editing) {
      await updateCampaign.mutateAsync({
        id: editing.id,
        body: {
          name: values.name.trim(),
          type: values.type,
          description: values.description?.trim() ? values.description.trim() : null,
          startsAt,
          endsAt: values.endsAt?.trim() ? endsIso! : null,
        },
      });
    } else {
      await createCampaign.mutateAsync({
        name: values.name.trim(),
        type: values.type,
        description: values.description?.trim(),
        startsAt,
        endsAt: endsIso,
        branchId: selectedBranchId ?? undefined,
      });
    }
    setEditorOpen(false);
    setEditing(null);
  }

  const editorPending = createCampaign.isPending || updateCampaign.isPending;

  async function confirmSend() {
    if (!sendTarget) return;
    try {
      const res = await sendCampaign.mutateAsync(sendTarget.id);
      setSendFlash(
        `Sent to ${res.data.recipientCount} recipient(s); ${res.data.sent} notification(s) delivered.`
      );
      setSendTarget(null);
      window.setTimeout(() => setSendFlash(null), 6000);
    } catch {
      /* error surfaced via sendCampaign.error */
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteCampaign.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      {sendFlash && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          {sendFlash}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 w-[160px] border-slate-200 bg-white text-slate-800"
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold text-slate-700">Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Type</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="font-semibold text-slate-700">Starts (WIB)</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Sent</TableHead>
              <TableHead className="text-right font-semibold text-slate-700 w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading campaigns…
                  </span>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-destructive text-sm">
                  {(error as Error)?.message ?? "Could not load campaigns."}
                </TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                  <Megaphone className="mx-auto mb-2 h-10 w-10 opacity-40" />
                  <p className="font-medium text-slate-600">No campaigns yet</p>
                  <p className="mt-1 text-sm">Create one to reach your customers.</p>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => {
                const canEdit = c.status === "DRAFT" || c.status === "SCHEDULED";
                const canSend = canEdit;
                return (
                  <TableRow key={c.id} className="border-slate-100">
                    <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                    <TableCell className="text-slate-600">{c.type.replace("_", " ")}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-slate-600 tabular-nums">
                      {formatStartsAt(c.startsAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {c.sentCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        )}
                        {canSend && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => setSendTarget(c)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Send
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
            <span className="text-slate-400"> · </span>
            {pagination.total} total
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md border-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Only draft and scheduled campaigns can be edited."
                : "Schedule a campaign for the selected branch."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Summer promo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <NativeSelect {...field} className="border-slate-200 bg-white">
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional message body or notes"
                        className="min-h-[88px] resize-y border-slate-200"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starts at</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="border-slate-200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ends at (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="border-slate-200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(createCampaign.error || updateCampaign.error) && (
                <p className="text-sm text-destructive">
                  {((createCampaign.error ?? updateCampaign.error) as Error).message}
                </p>
              )}
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
                <Button type="submit" disabled={editorPending} className="gap-2">
                  {editorPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Save changes" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendTarget} onOpenChange={(o) => !o && setSendTarget(null)}>
        <DialogContent className="border-slate-200">
          <DialogHeader>
            <DialogTitle>Send campaign</DialogTitle>
            <DialogDescription>
              Send &ldquo;{sendTarget?.name}&rdquo; now? Recipients depend on segment or branch
              activity on the server.
            </DialogDescription>
          </DialogHeader>
          {sendCampaign.error && (
            <p className="text-sm text-destructive">{(sendCampaign.error as Error).message}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSendTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmSend()}
              disabled={sendCampaign.isPending}
              className="gap-2"
            >
              {sendCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="border-slate-200">
          <DialogHeader>
            <DialogTitle>Delete campaign</DialogTitle>
            <DialogDescription>
              Permanently delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteCampaign.error && (
            <p className="text-sm text-destructive">{(deleteCampaign.error as Error).message}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteCampaign.isPending}
              className="gap-2"
            >
              {deleteCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
