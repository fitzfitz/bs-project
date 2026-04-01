import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { CrmDashboard } from "@/features/crm/widgets/crm-dashboard";
import { useBranchStore } from "@/store/use-branch-store";

export default function CrmPage() {
  const { t } = useTranslation();
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  return (
    <PageContainer>
      <PageHeader title={t("crm:title")} actions={<BranchSelector />} />
      {branchId ? (
        <CrmDashboard branchId={branchId} />
      ) : (
        <p className="text-muted-foreground">
          Select a branch to view customer data.
        </p>
      )}
    </PageContainer>
  );
}
