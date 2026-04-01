import { useState } from "react";
import {
  useNotificationAdminList,
  useNotificationStats,
  useTestSendNotification,
  type AdminListParams,
} from "../api/use-notification-admin";
import { Bell, Send, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const NOTIFICATION_TYPES = [
  "BOOKING_CONFIRMED",
  "QUEUE_CALLED",
  "QUEUE_COMPLETED",
  "APPOINTMENT_REMINDER",
  "RETENTION",
  "TEST",
] as const;

function StatsCards() {
  const { data: stats, isLoading } = useNotificationStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-white p-4 animate-pulse">
            <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-8 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;
  const s = stats.data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Total Sent</p>
        <p className="text-2xl font-bold text-slate-900">{s.totalSent.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Unread</p>
        <p className="text-2xl font-bold text-amber-600">{s.totalUnread.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Last 30 Days</p>
        <p className="text-2xl font-bold text-emerald-600">{s.last30Days.toLocaleString()}</p>
      </div>
    </div>
  );
}

function TypeBreakdown() {
  const { data: stats } = useNotificationStats();
  if (!stats) return null;
  const s = stats.data;
  if (!s.byType?.length) return null;

  const total = s.byType.reduce((sum, t) => sum + t.count, 0) || 1;

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">By Type</h3>
      <div className="space-y-2">
        {s.byType.map((t) => (
          <div key={t.type} className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500 w-44 truncate">{t.type}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(t.count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-700 w-10 text-right">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestSendDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const testSend = useTestSendNotification();

  if (!open) return null;

  const handleSend = async () => {
    if (!userId || !title || !body) return;
    await testSend.mutateAsync({ userId, title, body, type: "TEST" });
    setUserId("");
    setTitle("");
    setBody("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Send Test Notification</h2>
        <div>
          <label className="text-xs font-medium text-slate-600">User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Enter user ID"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Notification title"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
            placeholder="Notification body"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!userId || !title || !body || testSend.isPending}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {testSend.isPending ? "Sending..." : "Send"}
          </button>
        </div>
        {testSend.isError && (
          <p className="text-xs text-red-500">
            {(testSend.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}

export function NotificationManagement() {
  const [params, setParams] = useState<AdminListParams>({ page: 1, limit: 20 });
  const [typeFilter, setTypeFilter] = useState("");
  const [showTestSend, setShowTestSend] = useState(false);
  const { data, isLoading } = useNotificationAdminList({
    ...params,
    type: typeFilter || undefined,
  });

  const notifications = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setParams((p) => ({ ...p, page: 1 }));
                }}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                <option value="">All Types</option>
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowTestSend(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
            >
              <Send className="h-3.5 w-3.5" />
              Test Send
            </button>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">User</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : !notifications?.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No notifications found
                    </td>
                  </tr>
                ) : (
                  notifications.map((n: Record<string, unknown> & { id: string; user?: { firstName?: string; lastName?: string; email?: string }; title?: string; body?: string; type?: string; read?: boolean; createdAt?: string }) => (
                    <tr key={n.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{n.user?.firstName} {n.user?.lastName}</p>
                        <p className="text-xs text-slate-400">{n.user?.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-slate-700">{n.title}</p>
                        <p className="text-xs text-slate-400 truncate max-w-48">{n.body}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                          {n.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            n.read
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {n.read ? "Read" : "Unread"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  className="p-1.5 rounded-lg border hover:bg-slate-50 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  className="p-1.5 rounded-lg border hover:bg-slate-50 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <TypeBreakdown />
      </div>

      <TestSendDialog open={showTestSend} onClose={() => setShowTestSend(false)} />
    </div>
  );
}
