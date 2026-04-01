import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { ConfigPanel } from "@/features/config/widgets/config-panel";

export default function ConfigPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("config:title")} />
      <ConfigPanel />
    </PageContainer>
  );
}
