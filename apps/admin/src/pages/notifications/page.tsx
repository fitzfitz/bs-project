import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationManagement } from "@/features/notifications/widgets/notification-management";

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("notifications:title")} />
      <NotificationManagement />
    </PageContainer>
  );
}
