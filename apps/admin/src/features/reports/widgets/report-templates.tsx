import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useTemplates, useDeleteTemplate, type ReportType } from "../api/use-reports";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const REPORT_TYPES: { value: ReportType; labelKey: string }[] = [
  { value: "daily_revenue", labelKey: "dailyRevenue" },
  { value: "service_popularity", labelKey: "servicePopularity" },
  { value: "barber_leaderboard", labelKey: "barberLeaderboard" },
  { value: "staff_leaderboard", labelKey: "staffLeaderboard" },
  { value: "customer_visits", labelKey: "customerVisits" },
  { value: "booking_source", labelKey: "bookingSource" },
];

function typeLabel(t: (key: string) => string, type: ReportType): string {
  const row = REPORT_TYPES.find((r) => r.value === type);
  return row ? t(`reports:${row.labelKey}`) : type;
}

export function ReportTemplates() {
  const { t } = useTranslation(["reports", "common"]);
  const { data: templatesRes, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const templates = templatesRes?.data ?? [];

  if (error) {
    return <p className="text-sm text-destructive">{t("common:error")}</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("reports:noTemplates")}</p>;
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("reports:templateName")}</TableHead>
            <TableHead>{t("reports:reportType")}</TableHead>
            <TableHead className="w-[80px]">{t("common:actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{typeLabel(t, row.type)}</TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("common:delete")}
                  disabled={deleteTemplate.isPending}
                  onClick={() => deleteTemplate.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
