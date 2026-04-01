import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useBranchStore } from "@/store/use-branch-store";
import { WaitlistManagement } from "@/features/waitlist/widgets/waitlist-management";

export default function WaitlistPage() {
  const { t } = useTranslation("waitlist");
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";

  return (
    <PageContainer>
      <PageHeader title={t("title")} actions={<BranchSelector />} />
      <WaitlistManagement branchId={branchId} />
    </PageContainer>
  );
}
