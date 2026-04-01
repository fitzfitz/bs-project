import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  useReport,
  useExportCSV,
  useExportPDF,
  useCreateTemplate,
  type ReportType,
  type ReportData,
} from "../api/use-reports";
import { Download, FileDown, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const REPORT_TYPES: { value: ReportType; labelKey: string }[] = [
  { value: "daily_revenue", labelKey: "dailyRevenue" },
  { value: "service_popularity", labelKey: "servicePopularity" },
  { value: "barber_leaderboard", labelKey: "barberLeaderboard" },
  { value: "staff_leaderboard", labelKey: "staffLeaderboard" },
  { value: "customer_visits", labelKey: "customerVisits" },
  { value: "booking_source", labelKey: "bookingSource" },
];

const saveTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required"),
});

type SaveTemplateValues = z.infer<typeof saveTemplateSchema>;

export function ReportGenerator({ branchId, dateFrom, dateTo }: { branchId: string; dateFrom: string; dateTo: string }) {
  const org = useSessionStore((s) => s.user?.organization);
  const { t } = useTranslation(["reports", "common"]);
  const [type, setType] = useState<ReportType>("daily_revenue");
  const [templateOpen, setTemplateOpen] = useState(false);
  const { data, isLoading } = useReport({ type, branchId, dateFrom, dateTo });
  const exportCSV = useExportCSV();
  const exportPDF = useExportPDF();
  const createTemplate = useCreateTemplate();
  const report: ReportData | undefined = data?.data;

  const form = useForm<SaveTemplateValues>({
    resolver: zodResolver(saveTemplateSchema),
    defaultValues: { name: "" },
  });

  const openTemplateDialog = () => {
    form.reset({ name: "" });
    setTemplateOpen(true);
  };

  const onSaveTemplate = form.handleSubmit(async (values) => {
    await createTemplate.mutateAsync({
      name: values.name.trim(),
      type,
      branchId: branchId || null,
      dateFrom,
      dateTo,
    });
    setTemplateOpen(false);
    form.reset({ name: "" });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
          aria-label={t("reports:reportType")}
        >
          {REPORT_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {t(`reports:${r.labelKey}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="default"
          size="default"
          onClick={() => exportCSV.mutate({ type, branchId, dateFrom, dateTo })}
          disabled={exportCSV.isPending || !report}
        >
          <Download className="h-4 w-4" />
          {t("reports:exportCsv")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => exportPDF.mutate({ type, branchId, dateFrom, dateTo })}
          disabled={exportPDF.isPending || !report}
        >
          <FileDown className="h-4 w-4" />
          {t("reports:exportPdf")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={openTemplateDialog}
          disabled={!report || createTemplate.isPending}
        >
          <BookmarkPlus className="h-4 w-4" />
          {t("reports:saveTemplate")}
        </Button>
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reports:saveTemplateTitle")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSaveTemplate} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reports:templateName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("reports:templateName")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>
                  {t("common:cancel")}
                </Button>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {t("common:save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
      ) : report ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {(report.columns ?? []).map((col: string) => (
                  <th key={col} className="px-4 py-3 text-left font-medium text-slate-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report.rows ?? []).map((row: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  {(report.columns ?? []).map((col: string) => (
                    <td key={col} className="px-4 py-3 text-slate-700">
                      {typeof row[col] === "number" && /revenue|amount|spend|tips|value|profit|cost/i.test(col)
                        ? formatCurrency(row[col] as number, org?.currency, org?.locale)
                        : typeof row[col] === "number"
                        ? (row[col] as number).toLocaleString()
                        : String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
              {(report.rows ?? []).length === 0 && (
                <tr><td colSpan={report.columns?.length ?? 1} className="px-4 py-8 text-center text-slate-400">{t("reports:noData")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t("reports:selectType")}</p>
      )}
    </div>
  );
}
