import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  type ReportType,
  type ReportScheduleFrequency,
} from "../api/use-reports";
import { useBranches } from "@/features/pos/api/use-branches";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const REPORT_TYPES: { value: ReportType; labelKey: string }[] = [
  { value: "daily_revenue", labelKey: "dailyRevenue" },
  { value: "service_popularity", labelKey: "servicePopularity" },
  { value: "barber_leaderboard", labelKey: "barberLeaderboard" },
  { value: "staff_leaderboard", labelKey: "staffLeaderboard" },
  { value: "customer_visits", labelKey: "customerVisits" },
  { value: "booking_source", labelKey: "bookingSource" },
];

const FREQUENCIES: ReportScheduleFrequency[] = ["daily", "weekly", "monthly"];

const reportTypeEnum = z.enum([
  "daily_revenue",
  "service_popularity",
  "barber_leaderboard",
  "staff_leaderboard",
  "customer_visits",
  "booking_source",
]);

const scheduleFormSchema = z.object({
  type: reportTypeEnum,
  frequency: z.enum(["daily", "weekly", "monthly"]),
  branchId: z.string(),
  recipients: z.string().min(1, "Recipients are required"),
  active: z.boolean(),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

const defaultScheduleValues: ScheduleFormValues = {
  type: "daily_revenue",
  frequency: "daily",
  branchId: "",
  recipients: "",
  active: true,
};

function parseRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function typeLabel(t: (key: string) => string, type: ReportType): string {
  const row = REPORT_TYPES.find((r) => r.value === type);
  return row ? t(`reports:${row.labelKey}`) : type;
}

function formatTs(value: string | null, empty: string): string {
  if (!value) return empty;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function ReportSchedules() {
  const { t } = useTranslation(["reports", "common"]);
  const { data: schedulesRes, isLoading, error } = useSchedules();
  const { data: branchesRes } = useBranches();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const [createOpen, setCreateOpen] = useState(false);

  const schedules = schedulesRes?.data ?? [];
  const branches = branchesRes?.data ?? [];

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: defaultScheduleValues,
  });

  const openCreate = () => {
    form.reset(defaultScheduleValues);
    setCreateOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const recipients = parseRecipients(values.recipients);
    if (recipients.length === 0) return;
    await createSchedule.mutateAsync({
      type: values.type,
      frequency: values.frequency,
      branchId: values.branchId || null,
      recipients,
      active: values.active,
    });
    setCreateOpen(false);
    form.reset(defaultScheduleValues);
  });

  if (error) {
    return <p className="text-sm text-destructive">{t("common:error")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("reports:createSchedule")}
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reports:createSchedule")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reports:reportType")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REPORT_TYPES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {t(`reports:${r.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reports:frequency")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(`reports:${f}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:branch")}</FormLabel>
                    <p className="text-xs text-muted-foreground">{t("reports:branchOptionalHint")}</p>
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("common:allBranches")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">{t("common:allBranches")}</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reports:recipients")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="a@x.com, b@y.com" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("reports:recipientsHint")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FormLabel className="mt-0">{t("common:active")}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t("common:cancel")}
                </Button>
                <Button type="submit" disabled={createSchedule.isPending}>
                  {t("common:create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reports:noSchedules")}</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports:reportType")}</TableHead>
                <TableHead>{t("reports:frequency")}</TableHead>
                <TableHead>{t("reports:recipients")}</TableHead>
                <TableHead>{t("common:active")}</TableHead>
                <TableHead>{t("reports:lastSent")}</TableHead>
                <TableHead>{t("reports:nextRun")}</TableHead>
                <TableHead className="w-[100px]">{t("common:actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{typeLabel(t, row.type)}</TableCell>
                  <TableCell>{t(`reports:${row.frequency}`)}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={(row.recipients ?? []).join(", ")}>
                    {(row.recipients ?? []).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.active}
                      disabled={updateSchedule.isPending}
                      onCheckedChange={(checked) => {
                        updateSchedule.mutate({ id: row.id, body: { active: checked } });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatTs(row.lastSent, "—")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatTs(row.nextRun, "—")}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("common:delete")}
                      disabled={deleteSchedule.isPending}
                      onClick={() => deleteSchedule.mutate(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
