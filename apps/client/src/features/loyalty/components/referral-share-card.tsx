import { useState } from "react";
import { Copy, Share2, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReferralHistoryItem } from "../types";

type Props = {
  referralCode: string | undefined;
  history?: ReferralHistoryItem[];
  isLoading?: boolean;
};

export function ReferralShareCard({
  referralCode,
  history,
  isLoading,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (isLoading || !referralCode) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 animate-pulse">
        <div className="h-4 w-32 rounded bg-slate-100 mb-4" />
        <div className="h-12 rounded-xl bg-slate-50" />
      </div>
    );
  }

  const completedCount =
    history?.filter((r) => r.status === "COMPLETED").length ?? 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join me at The Barber Project!",
      text: `Use my referral code ${referralCode} to sign up and we both earn bonus points!`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed — fall back to copy
        handleCopy();
      }
    } else {
      // Fallback: WhatsApp deep link
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
      window.open(waUrl, "_blank");
    }
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-700">
          Refer a Friend
        </div>
        {completedCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Users className="h-3.5 w-3.5" />
            {completedCount} referred
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Share your code and earn <strong>10 bonus points</strong> when your
        friend completes their first visit.
      </p>

      {/* Code display */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
        <code className="flex-1 text-center text-lg font-black tracking-[0.2em] text-slate-800">
          {referralCode}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <Button
        className="mt-3 w-full rounded-xl h-11 font-semibold gap-2"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
        Share Code
      </Button>

      {/* Referral history preview */}
      {history && history.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Recent Referrals
          </div>
          <div className="space-y-2">
            {history.slice(0, 3).map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-slate-700">
                  {ref.refereeName}
                </span>
                <span
                  className={`font-semibold ${
                    ref.status === "COMPLETED"
                      ? "text-emerald-600"
                      : ref.status === "EXPIRED"
                        ? "text-slate-400"
                        : "text-amber-500"
                  }`}
                >
                  {ref.status === "COMPLETED"
                    ? `+${ref.bonusPoints} pts`
                    : ref.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
