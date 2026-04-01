import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa" },
] as const;

export function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { i18n } = useTranslation();

  const current = languages.find((l) => l.code === i18n.language) ?? languages[0];

  const toggle = () => {
    const next = i18n.language === "en" ? "id" : "en";
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      title={collapsed ? current.label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700",
        collapsed && "justify-center px-2"
      )}
    >
      <Globe className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{current.label}</span>}
    </button>
  );
}
