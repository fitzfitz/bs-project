import { useState } from "react";
import { useBranchStore } from "@/store/use-branch-store";
import {
  useAuditLogs,
  useAnomalies,
  useAnomalyStats,
  useResolveAnomaly,
  type AuditLogEntry,
  type AnomalyFlag,
} from "../api/use-audit";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TABS = ["Audit Logs", "Anomalies"] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-blue-100 text-blue-700 border-blue-200",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  STATUS_CHANGE: "bg-amber-100 text-amber-700",
  ASSIGN_ROLE: "bg-purple-100 text-purple-700",
  REMOVE_ROLE: "bg-purple-100 text-purple-700",
  DEACTIVATE_USER: "bg-red-100 text-red-700",
  BRANCH_ASSIGNMENT: "bg-indigo-100 text-indigo-700",
  ANOMALY_FLAGGED: "bg-orange-100 text-orange-700",
  VOID_TRANSACTION: "bg-red-100 text-red-700",
  APPLY_DISCOUNT: "bg-amber-100 text-amber-700",
  CLOCK_IN: "bg-green-100 text-green-700",
  CLOCK_OUT: "bg-slate-100 text-slate-700",
};

export function AuditViewer() {
  const [tab, setTab] = useState<Tab>("Audit Logs");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Audit Logs" ? <AuditLogTab /> : <AnomalyTab />}
    </div>
  );
}

function AuditLogTab() {
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useAuditLogs({
    branchId: branchId ?? undefined,
    action: action || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 30,
  });

  const logs: AuditLogEntry[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Actions</option>
          {["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "ASSIGN_ROLE", "DEACTIVATE_USER", "BRANCH_ASSIGNMENT", "VOID_TRANSACTION", "APPLY_DISCOUNT", "CLOCK_IN", "CLOCK_OUT"].map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Branch</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No audit logs found</td></tr>
              ) : logs.map((log) => (
                <>
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <p className="font-medium text-slate-700">{log.user.firstName} {log.user.lastName}</p>
                          <p className="text-xs text-slate-400">{log.user.tenantRole?.name ?? "—"}</p>
                        </div>
                      ) : <span className="text-xs text-slate-400">System</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-slate-600">{log.entityType}</span>
                      <span className="text-slate-400 ml-1">#{log.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{log.branch?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {expandedId === log.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </td>
                  </tr>
                  {expandedId === log.id && log.details && (
                    <tr key={`${log.id}-details`}>
                      <td colSpan={6} className="px-4 py-3 bg-slate-50">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">{pagination.total} logs total</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs text-slate-600">Page {page} of {pagination.totalPages}</span>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnomalyTab() {
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const [showResolved, setShowResolved] = useState(false);
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: statsData } = useAnomalyStats(branchId ?? undefined);
  const stats = (statsData as any)?.data;

  const { data, isLoading } = useAnomalies({
    branchId: branchId ?? undefined,
    isResolved: showResolved ? "true" : "false",
    page,
    limit: 20,
  });

  const resolve = useResolveAnomaly();
  const anomalies: AnomalyFlag[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination;

  function handleResolve() {
    if (!resolving) return;
    resolve.mutate({ id: resolving, notes: resolveNotes || undefined }, {
      onSuccess: () => { setResolving(null); setResolveNotes(""); },
    });
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatMini label="Total Anomalies" value={stats.total} />
          <StatMini label="Unresolved" value={stats.unresolved} highlight />
          {(stats.bySeverity ?? []).filter((s: any) => s.severity === "CRITICAL" || s.severity === "HIGH").map((s: any) => (
            <StatMini key={s.severity} label={s.severity} value={s.count} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showResolved} onChange={(e) => { setShowResolved(e.target.checked); setPage(1); }} className="rounded border-slate-300" />
          Show resolved
        </label>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Shield className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p>No anomalies found</p>
          </div>
        ) : anomalies.map((a) => (
          <div key={a.id} className={`rounded-xl border p-4 ${SEVERITY_COLORS[a.severity] ?? "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.type.replace(/_/g, " ")}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/50">{a.severity}</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">
                    {a.branch.name} {a.user ? `• ${a.user.firstName} ${a.user.lastName}` : ""}
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(a.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                  </p>
                  {a.details && (
                    <pre className="text-xs mt-2 bg-white/30 rounded p-2 max-h-24 overflow-y-auto">
                      {JSON.stringify(a.details, null, 2)}
                    </pre>
                  )}
                  {a.isResolved && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolved {a.resolvedAt ? `on ${new Date(a.resolvedAt).toLocaleDateString("id-ID")}` : ""}
                    </div>
                  )}
                </div>
              </div>
              {!a.isResolved && (
                <button
                  onClick={() => setResolving(a.id)}
                  className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium hover:bg-white transition-colors"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs text-slate-600">Page {page} of {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Resolve Anomaly</h3>
            <textarea
              placeholder="Resolution notes (optional)..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {resolve.error && <p className="text-xs text-red-600">{(resolve.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setResolving(null); setResolveNotes(""); }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={handleResolve} disabled={resolve.isPending} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
                {resolve.isPending ? "Saving..." : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-orange-700" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}
