import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useLoyaltyAccount } from "../api/use-loyalty-account";
import { useLoyaltyHistory } from "../api/use-loyalty-history";
import { useReferralCode } from "../api/use-referral-code";
import { useReferralHistory } from "../api/use-referral-history";
import { LoyaltyCard } from "../components/loyalty-card";
import { TierProgressBar } from "../components/tier-progress-bar";
import { PointsHistoryList } from "../components/points-history-list";
import { ReferralShareCard } from "../components/referral-share-card";

export function LoyaltyDashboard() {
  const [historyPage, setHistoryPage] = useState(1);

  const {
    data: accountData,
    isLoading: accountLoading,
    error: accountError,
  } = useLoyaltyAccount();
  const {
    data: historyData,
    isLoading: historyLoading,
  } = useLoyaltyHistory(historyPage);
  const { data: codeData, isLoading: codeLoading } = useReferralCode();
  const { data: refHistoryData } = useReferralHistory();

  const account = accountData?.data;
  const transactions = historyData?.data ?? [];
  const pagination = historyData?.pagination;
  const referralCode = codeData?.data?.referralCode;
  const referralHistory = refHistoryData?.data;

  if (accountError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-600">
          Could not load loyalty info
        </p>
        <p className="text-xs text-slate-400 mt-1">Please try again later</p>
      </div>
    );
  }

  if (accountLoading || !account) {
    return (
      <div className="space-y-4">
        {/* Card skeleton */}
        <div className="rounded-2xl bg-slate-900 p-6 h-52 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="h-4 w-16 rounded bg-white/10" />
            </div>
          </div>
          <div className="mt-8 space-y-2">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-8 w-32 rounded bg-white/10" />
          </div>
        </div>
        {/* Progress skeleton */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 h-28 animate-pulse">
          <div className="h-3.5 w-24 rounded bg-slate-100 mb-4" />
          <div className="h-2.5 w-full rounded-full bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoyaltyCard account={account} />
      <TierProgressBar
        lifetimePoints={account.lifetimePoints}
        currentTier={account.tier}
      />
      <ReferralShareCard
        referralCode={referralCode}
        history={referralHistory}
        isLoading={codeLoading}
      />
      <PointsHistoryList
        transactions={transactions}
        pagination={pagination}
        page={historyPage}
        onPageChange={setHistoryPage}
        isLoading={historyLoading}
      />
    </div>
  );
}
