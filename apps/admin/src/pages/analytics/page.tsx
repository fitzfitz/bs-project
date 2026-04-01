import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsDashboard } from "@/features/analytics/widgets/analytics-dashboard";

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState({ from: getDefaultFrom(), to: getDefaultTo() });

  return (
    <PageContainer>
      <PageHeader
        title={t("analytics:title")}
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
      <AnalyticsDashboard dateFrom={dateRange.from} dateTo={dateRange.to} />
    </PageContainer>
  );
}

function getDefaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function getDefaultTo() {
  return new Date().toISOString().slice(0, 10);
}
