import { useState } from "react";
import { useTranslation } from "react-i18next";
import { InventoryManager } from "@/features/inventory/widgets/inventory-manager";
import { ProductManager } from "@/features/inventory/widgets/product-manager";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function InventoryPage() {
  const { t } = useTranslation();
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const [tab, setTab] = useState<"stock" | "products">("stock");

  return (
    <PageContainer>
      <PageHeader title={t("inventory:title")} actions={<BranchSelector />} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "stock" | "products")} className="w-full">
        <TabsList>
          <TabsTrigger value="stock">{t("inventory:stock")}</TabsTrigger>
          <TabsTrigger value="products">{t("inventory:products")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          <InventoryManager branchId={branchId} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductManager />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
