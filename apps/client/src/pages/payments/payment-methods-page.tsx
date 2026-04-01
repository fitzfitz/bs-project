import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Plus, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePaymentMethods,
  useSavePaymentMethod,
  useDeletePaymentMethod,
  type SavedPaymentMethod,
} from "@/features/payments/api/use-payment-methods";
import { useConfirmation } from "@/components/ui/confirmation";

function PaymentMethodCard({
  method,
  onDelete,
}: {
  method: SavedPaymentMethod;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation("payments");
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
        <CreditCard className="w-6 h-6 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            •••• {method.last4}
          </span>
          {method.isDefault && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {t("default")}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          {method.type} · {t("expiresLabel")}{" "}
          {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}
        </p>
      </div>
      <button
        onClick={() => onDelete(method.id)}
        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddPaymentMethodForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation(["payments", "common"]);
  const save = useSavePaymentMethod();
  const [last4, setLast4] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        tokenId: `tok_${Date.now()}`,
        last4,
        expiryMonth: parseInt(expiryMonth, 10),
        expiryYear: parseInt(expiryYear, 10),
        isDefault,
      },
      { onSuccess },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
      <h3 className="font-semibold text-slate-800">{t("addPaymentMethodFormTitle")}</h3>
      <p className="text-sm text-slate-500">
        {t("devFormHint")}
      </p>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">{t("last4")}</label>
        <input
          type="text"
          maxLength={4}
          pattern="[0-9]{4}"
          value={last4}
          onChange={(e) => setLast4(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="4242"
          required
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">{t("expiryMonth")}</label>
          <input
            type="number"
            min={1}
            max={12}
            value={expiryMonth}
            onChange={(e) => setExpiryMonth(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="12"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">{t("expiryYear")}</label>
          <input
            type="number"
            min={2025}
            value={expiryYear}
            onChange={(e) => setExpiryYear(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="2028"
            required
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isDefault ? "bg-primary border-primary text-white" : "border-slate-300"}`}
          onClick={() => setIsDefault(!isDefault)}
        >
          {isDefault && <Check className="w-3 h-3" />}
        </div>
        <span className="text-sm text-slate-600">{t("setAsDefault")}</span>
      </label>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          {t("common:cancel")}
        </Button>
        <Button type="submit" className="flex-1" disabled={save.isPending}>
          {save.isPending ? t("saving") : t("saveCard")}
        </Button>
      </div>
    </form>
  );
}

export default function PaymentMethodsPage() {
  const { t } = useTranslation("payments");
  const navigate = useNavigate();
  const { data: methods, isLoading, isError } = usePaymentMethods();
  const deleteMutation = useDeletePaymentMethod();
  const { confirm } = useConfirmation();
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t("removeTitle"),
      description: t("removeDescription"),
      confirmLabel: t("removeConfirm"),
      cancelLabel: t("keep"),
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(id);
  };

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
        {!showAdd && (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary text-xs gap-1"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("addCard")}
          </Button>
        )}
      </header>

      <div className="flex-1 p-4 space-y-3">
        {showAdd && (
          <AddPaymentMethodForm
            onCancel={() => setShowAdd(false)}
            onSuccess={() => setShowAdd(false)}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500 text-sm">
            {t("loadFailed")}
          </div>
        ) : methods && methods.length > 0 ? (
          methods.map((m) => (
            <PaymentMethodCard
              key={m.id}
              method={m}
              onDelete={handleDelete}
            />
          ))
        ) : (
          !showAdd && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">{t("noCards")}</p>
              <p className="text-sm text-slate-400 mt-1">
                {t("noCardsHint")}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> {t("addPaymentMethod")}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
