import { useState } from "react";
import {
  Award,
  TrendingUp,
  Users,
  Gift,
  Search,
  Plus,
  Minus,
  Timer,
} from "lucide-react";
import {
  useAdjustPoints,
  useExpirePoints,
  useReferralStats,
  useCustomerMembership,
} from "@/features/loyalty/api/use-loyalty-admin";

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-orange-100 text-orange-700",
  SILVER: "bg-slate-100 text-slate-600",
  GOLD: "bg-amber-100 text-amber-700",
  PLATINUM: "bg-violet-100 text-violet-700",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function LookupSection() {
  const [userId, setUserId] = useState("");
  const [searchId, setSearchId] = useState<string | undefined>();
  const { data, isLoading, error } = useCustomerMembership(searchId);
  const account = data?.data;

  const adjustPoints = useAdjustPoints();
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (userId.trim()) setSearchId(userId.trim());
  };

  const handleAdjust = (isPositive: boolean) => {
    if (!searchId || !adjustAmount) return;
    const pts = Math.abs(parseInt(adjustAmount, 10));
    if (isNaN(pts) || pts <= 0) return;
    adjustPoints.mutate(
      {
        userId: searchId,
        points: isPositive ? pts : -pts,
        description: adjustDesc || (isPositive ? "Manual credit" : "Manual deduction"),
      },
      {
        onSuccess: () => {
          setAdjustAmount("");
          setAdjustDesc("");
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Customer Lookup</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Search by user ID to view and adjust loyalty points
        </p>
      </div>

      <div className="p-5 space-y-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </form>

        {isLoading && <div className="h-20 animate-pulse rounded-lg bg-slate-100" />}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        {account && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-400">Tier</p>
                <span
                  className={`mt-1 inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${TIER_COLORS[account.tier] ?? ""}`}
                >
                  {account.tier}
                </span>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-400">Balance</p>
                <p className="text-lg font-bold text-slate-900">
                  {account.pointsBalance.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-400">Lifetime</p>
                <p className="text-lg font-bold text-slate-900">
                  {account.lifetimePoints.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-400">Multiplier</p>
                <p className="text-lg font-bold text-slate-900">{account.tierMultiplier}x</p>
              </div>
            </div>

            {account.pointsExpiringAt && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" />
                Points expire:{" "}
                {new Date(account.pointsExpiringAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}

            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Adjust Points</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-28"
                />
                <input
                  value={adjustDesc}
                  onChange={(e) => setAdjustDesc(e.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjust(true)}
                    disabled={adjustPoints.isPending || !adjustAmount}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjust(false)}
                    disabled={adjustPoints.isPending || !adjustAmount}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" /> Debit
                  </button>
                </div>
              </div>
              {adjustPoints.isSuccess && (
                <p className="text-xs text-emerald-600 mt-2">Points adjusted successfully.</p>
              )}
              {adjustPoints.isError && (
                <p className="text-xs text-red-600 mt-2">
                  {(adjustPoints.error as Error).message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  const { data: statsData, isLoading: statsLoading } = useReferralStats();
  const stats = statsData?.data;
  const expire = useExpirePoints();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Loyalty & Referrals</h1>
        <button
          type="button"
          onClick={() => expire.mutate()}
          disabled={expire.isPending}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <Timer className="h-4 w-4" />
          {expire.isPending ? "Processing..." : "Run Point Expiry"}
        </button>
      </div>

      {expire.isSuccess && expire.data && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Expiry processed: {(expire.data as any).data?.accountsProcessed ?? 0} accounts,{" "}
          {(expire.data as any).data?.totalExpired ?? 0} points expired.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="Tier Config"
          value="4 Tiers"
          sub="Bronze → Silver → Gold → Platinum"
        />
        <StatCard
          icon={TrendingUp}
          label="Earn Rate"
          value="1 pt / Rp10K"
          sub="With tier multipliers"
        />
        {statsLoading ? (
          <>
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          </>
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Total Referrals"
              value={stats?.total ?? 0}
              sub={`${stats?.completed ?? 0} completed, ${stats?.pending ?? 0} pending`}
            />
            <StatCard
              icon={Gift}
              label="Conversion Rate"
              value={`${((stats?.conversionRate ?? 0) * 100).toFixed(1)}%`}
              sub="Referrals → Completed"
            />
          </>
        )}
      </div>

      <LookupSection />
    </div>
  );
}
