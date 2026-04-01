import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationBellProps {
  unreadCount: number;
  notifications: NotificationItem[];
  onMarkAllRead?: () => void;
}

export function NotificationBell({
  unreadCount,
  notifications,
  onMarkAllRead,
}: NotificationBellProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
          aria-label={t("common:notifications")}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
              aria-live="polite"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">{t("common:notifications")}</h4>
          {onMarkAllRead && unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("common:markAllRead")}
            </button>
          )}
        </div>
        <Separator />
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              {t("common:noNotifications")}
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-slate-50",
                  !n.readAt && "bg-primary/5",
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {n.body}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(n.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
        <Separator />
        <div className="p-2">
          <Link
            to="/notifications"
            className="block rounded-md px-3 py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/5"
          >
            {t("common:viewAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
