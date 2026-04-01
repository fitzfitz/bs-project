import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getRouteLabel } from "@/lib/nav-config";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function AppBreadcrumbs() {
  const location = useLocation();
  const { t } = useTranslation();

  if (location.pathname === "/") {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium text-foreground">
              {t("common:home")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const routeInfo = getRouteLabel(location.pathname);

  const pageName = routeInfo
    ? t(routeInfo.labelKey)
    : location.pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

  const groupName = routeInfo?.groupLabelKey
    ? t(routeInfo.groupLabelKey)
    : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">{t("common:home")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {groupName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground">{groupName}</span>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-sm font-medium">
            {pageName}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
