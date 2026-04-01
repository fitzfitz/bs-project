import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings, LogOut, Globe } from "lucide-react";
import { useSessionStore } from "@/features/auth/store";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileDropdown() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);

  if (!user) return null;

  const initials = getInitials(user.firstName, user.lastName);
  const scopeColor =
    user.tenantRole?.scope === "HQ"
      ? "bg-primary/15 text-primary"
      : "bg-info/15 text-info";

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "id" : "en");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] font-medium text-primary/80 leading-tight">
              {user.tenantRole?.name ?? "Staff"}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {user.tenantRole && (
              <span
                className={`mt-1 inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${scopeColor}`}
              >
                {user.tenantRole.name} &middot; {user.tenantRole.scope}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={toggleLanguage}>
            <Globe className="mr-2 h-4 w-4" />
            {t("common:language")} ({i18n.language === "en" ? "ID" : "EN"})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/config")}>
            <Settings className="mr-2 h-4 w-4" />
            {t("sidebar:settings")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => clearSession()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("common:logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
