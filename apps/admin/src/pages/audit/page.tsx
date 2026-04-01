import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { AuditViewer } from "@/features/audit/widgets/audit-viewer";

export default function AuditPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("audit:title")} />
      <AuditViewer />
    </PageContainer>
  );
}
