import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignManager } from "@/features/campaigns/widgets/campaign-manager";

export default function CampaignsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("campaigns:title")} actions={<BranchSelector />} />
      <CampaignManager />
    </PageContainer>
  );
}
