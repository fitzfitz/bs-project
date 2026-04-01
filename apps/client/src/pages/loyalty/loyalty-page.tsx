import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LoyaltyDashboard } from "@/features/loyalty/widgets/loyalty-dashboard";

export default function LoyaltyPage() {
  const { t } = useTranslation("loyalty");
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        <LoyaltyDashboard />
      </div>
    </div>
  );
}
