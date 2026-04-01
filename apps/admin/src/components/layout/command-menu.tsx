import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSessionStore, hasAnyPermission } from "@/features/auth/store";
import { navGroups } from "@/lib/nav-config";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permissions = useSessionStore((s) => s.user?.permissions);

  const handleSelect = useCallback(
    (route: string) => {
      onOpenChange(false);
      navigate(route);
    },
    [navigate, onOpenChange],
  );

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.feature || hasAnyPermission(permissions, item.feature),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("common:searchPages")} />
      <CommandList>
        <CommandEmpty>{t("common:noResults")}</CommandEmpty>
        {filteredGroups.map((group) => (
          <CommandGroup key={group.id} heading={t(group.labelKey)}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${t(item.labelKey)} ${item.to}`}
                onSelect={() => handleSelect(item.to)}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{t(item.labelKey)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
