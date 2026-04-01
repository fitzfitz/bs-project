import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { UserManagement } from "@/features/users/widgets/user-management";

export default function UsersPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t("users:title")} />
      <UserManagement />
    </PageContainer>
  );
}
