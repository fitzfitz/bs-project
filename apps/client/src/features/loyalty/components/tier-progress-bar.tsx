import type { LoyaltyTier } from "../types";
import { TIER_THRESHOLDS, TIER_ORDER, TIER_COLORS } from "../types";

type Props = {
  lifetimePoints: number;
  currentTier: LoyaltyTier;
};

export function TierProgressBar({ lifetimePoints, currentTier }: Props) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const isMaxTier = currentTier === "PLATINUM";

  const nextTier = isMaxTier ? null : TIER_ORDER[currentIndex + 1];
  const currentThreshold = TIER_THRESHOLDS[currentTier];
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : currentThreshold;

  const rangeSize = nextThreshold - currentThreshold;
  const progress = isMaxTier
    ? 100
    : Math.min(
        100,
        Math.round(((lifetimePoints - currentThreshold) / rangeSize) * 100),
      );

  const pointsToNext = isMaxTier ? 0 : nextThreshold - lifetimePoints;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="text-sm font-semibold text-slate-700 mb-3">
        Tier Progress
      </div>

      {/* Tier markers */}
      <div className="flex justify-between mb-2">
        {TIER_ORDER.map((tier) => {
          const isActive = TIER_ORDER.indexOf(tier) <= currentIndex;
          return (
            <div key={tier} className="flex flex-col items-center gap-1">
              <div
                className="h-3 w-3 rounded-full border-2 transition-colors"
                style={{
                  backgroundColor: isActive ? TIER_COLORS[tier] : "transparent",
                  borderColor: TIER_COLORS[tier],
                }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color: isActive ? TIER_COLORS[tier] : "#94a3b8",
                }}
              >
                {tier.slice(0, 1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: TIER_COLORS[currentTier],
          }}
        />
      </div>

      {/* Status text */}
      <div className="mt-3 text-xs text-slate-500">
        {isMaxTier ? (
          <span className="font-medium" style={{ color: TIER_COLORS.PLATINUM }}>
            Maximum tier reached!
          </span>
        ) : (
          <>
            <span className="font-semibold text-slate-700">
              {pointsToNext.toLocaleString("id-ID")}
            </span>{" "}
            lifetime points to{" "}
            <span
              className="font-semibold"
              style={{ color: nextTier ? TIER_COLORS[nextTier] : undefined }}
            >
              {nextTier}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
