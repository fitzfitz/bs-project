import { Crown, Sparkles } from "lucide-react";
import type { CustomerMembership } from "../types";
import { TIER_COLORS, POINTS_VALUE_IDR } from "../types";

type Props = {
  account: CustomerMembership;
};

export function LoyaltyCard({ account }: Props) {
  const tierColor = TIER_COLORS[account.tier];
  const expiryDate = account.pointsExpiringAt
    ? new Date(account.pointsExpiringAt)
    : null;
  const pointsValueIdr = account.pointsBalance * POINTS_VALUE_IDR;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
      {/* Decorative glow */}
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: tierColor }}
      />
      <div
        className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full opacity-15 blur-xl"
        style={{ backgroundColor: tierColor }}
      />

      {/* Tier badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: `${tierColor}30` }}
          >
            <Crown className="h-5 w-5" style={{ color: tierColor }} />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-white/60">
              Member Tier
            </div>
            <div
              className="text-lg font-bold"
              style={{ color: tierColor }}
            >
              {account.tier}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
          <Sparkles className="h-3 w-3" />
          {account.tierMultiplier}x points
        </div>
      </div>

      {/* Points balance */}
      <div className="relative z-10 mt-6">
        <div className="text-xs font-medium uppercase tracking-wider text-white/50">
          Points Balance
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-black tabular-nums">
            {account.pointsBalance.toLocaleString("id-ID")}
          </span>
          <span className="text-sm font-medium text-white/40">pts</span>
        </div>
        <div className="mt-1 text-xs text-white/40">
          Worth Rp {pointsValueIdr.toLocaleString("id-ID")}
        </div>
      </div>

      {/* Expiry notice */}
      {expiryDate && account.pointsBalance > 0 && (
        <div className="relative z-10 mt-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">
          Points expire{" "}
          <span className="font-medium text-white/70">
            {expiryDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
