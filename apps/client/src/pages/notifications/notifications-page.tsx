import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotificationList,
  useMarkRead,
  useMarkAllRead,
  type NotificationItem,
} from "@/features/notifications/api/use-notifications";
import { formatDistanceToNow } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  BOOKING_CONFIRMED: "Booking",
  QUEUE_CALLED: "Queue",
  QUEUE_COMPLETED: "Service",
  APPOINTMENT_REMINDER: "Reminder",
  CAMPAIGN: "Promo",
  RETENTION: "We miss you",
};

function NotificationRow({
  notification,
  onMarkRead,
  typeLabel,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  typeLabel: string;
}) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      type="button"
      className={`w-full text-left p-4 border-b border-slate-100 transition-colors ${notification.read ? "bg-white" : "bg-primary/5"}`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id);
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notification.read ? "bg-transparent" : "bg-primary"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
              {typeLabel}
            </span>
            <span className="text-[10px] text-slate-400">{timeAgo}</span>
          </div>
          <h3
            className={`text-sm font-semibold ${notification.read ? "text-slate-600" : "text-slate-900"}`}
          >
            {notification.title}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation(["notifications", "common"]);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useNotificationList(page);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data ?? [];
  const pagination = data?.pagination;

  const getTypeLabel = (type: string) => TYPE_LABELS[type] ?? type;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary text-xs gap-1"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {t("markAllRead")}
        </Button>
      </header>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500 text-sm">
            {t("loadFailed")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">{t("noNotifications")}</p>
            <p className="text-sm text-slate-400 mt-1">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white">
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  typeLabel={getTypeLabel(n.type)}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("previous")}
                </Button>
                <span className="text-sm text-slate-500">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
