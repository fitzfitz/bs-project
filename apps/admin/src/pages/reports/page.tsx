import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useBranchStore } from "@/store/use-branch-store";
import { ReportGenerator } from "@/features/reports/widgets/report-generator";
import { ReportSchedules } from "@/features/reports/widgets/report-schedules";
import { ReportTemplates } from "@/features/reports/widgets/report-templates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReportsPage() {
  const { t } = useTranslation(["reports", "common"]);
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const [dateRange, setDateRange] = useState({ from: getDefaultFrom(), to: getDefaultTo() });

  return (
    <PageContainer>
      <PageHeader
        title={t("reports:title")}
        actions={
          <>
            <BranchSelector />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
              />
              <span className="text-sm text-slate-400">{t("common:to")}</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
              />
            </div>
          </>
        }
      />

      <Tabs defaultValue="generate" className="w-full">
        <TabsList>
          <TabsTrigger value="generate">{t("reports:tabGenerate")}</TabsTrigger>
          <TabsTrigger value="schedules">{t("reports:schedules")}</TabsTrigger>
          <TabsTrigger value="templates">{t("reports:templates")}</TabsTrigger>
        </TabsList>
        <TabsContent value="generate" className="mt-4">
          <ReportGenerator branchId={branchId ?? ""} dateFrom={dateRange.from} dateTo={dateRange.to} />
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <ReportSchedules />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <ReportTemplates />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function getDefaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getDefaultTo() {
  return new Date().toISOString().slice(0, 10);
}
