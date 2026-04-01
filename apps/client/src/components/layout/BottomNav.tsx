import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, CalendarPlus, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const { t } = useTranslation("nav");
  const links = [
    { to: "/", icon: Home, label: t("home") },
    { to: "/book", icon: CalendarPlus, label: t("book") },
    { to: "/history", icon: Clock, label: t("history") },
    { to: "/profile", icon: User, label: t("profile") },
  ];

  return (
    <nav className="sticky bottom-0 w-full bg-white border-t border-slate-200 safe-area-bottom pb-4 pt-2 px-6 flex justify-between items-center z-50 rounded-t-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors duration-200 min-w-16 py-2",
              isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <link.icon
                className={cn("w-6 h-6", isActive && "fill-primary/20")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive && "font-semibold"
                )}
              >
                {link.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
