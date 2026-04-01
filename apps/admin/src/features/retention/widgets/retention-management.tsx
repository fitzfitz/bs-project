import { useState } from "react";
import {
  useRetentionStats,
  useTriggerRetention,
} from "../api/use-retention-management";
import { Activity, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

export function RetentionManagement() {
  const { data: stats, isLoading } = useRetentionStats();
  const trigger = useTriggerRetention();
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<{
    atRiskSent: number;
    expirySent: number;
  } | null>(null);

  const s = stats?.data;

  const handleTrigger = async () => {
    setShowConfirm(false);
    const result = await trigger.mutateAsync();
    setLastResult(result.data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <Activity className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Total Nudges Sent</p>
          </div>
          {isLoading ? (
            <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900">
              {s?.totalNudges.toLocaleString() ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <Zap className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Last 30 Days</p>
          </div>
          {isLoading ? (
            <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900">
              {s?.last30Days.toLocaleString() ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-white p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Trigger Policy</p>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <p>At-risk window: 30-60 days inactive</p>
            <p>Points expiry: within 7 days</p>
            <p>Cooldown: 14 days between nudges</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Manual Trigger</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Run the retention nudge engine manually. This will send push notifications to
              at-risk customers and users with expiring points.
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={trigger.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 shrink-0"
          >
            <Zap className="h-4 w-4" />
            {trigger.isPending ? "Running..." : "Run Retention Triggers"}
          </button>
        </div>

        {lastResult && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Trigger Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-xs text-emerald-600">At-Risk Nudges</p>
                <p className="text-xl font-bold text-emerald-800">{lastResult.atRiskSent}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600">Expiry Nudges</p>
                <p className="text-xl font-bold text-emerald-800">{lastResult.expirySent}</p>
              </div>
            </div>
          </div>
        )}

        {trigger.isError && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">
              {(trigger.error as Error).message}
            </p>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Confirm Trigger</h2>
            <p className="text-sm text-slate-600">
              This will scan for at-risk customers and expiring points, then send push
              notifications. Cooldown rules will prevent duplicate sends.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTrigger}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                Run Triggers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
