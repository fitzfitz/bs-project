import { useTranslation } from "react-i18next";
import { ServiceManager } from "@/features/services/widgets/service-manager";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function ServicesPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("services:title")} />
      <ServiceManager />
    </PageContainer>
  );
}
