import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { RetentionManagement } from "@/features/retention/widgets/retention-management";

export default function RetentionPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("retention:title")} />
      <RetentionManagement />
    </PageContainer>
  );
}
