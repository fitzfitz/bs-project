import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useConfig, useUpdateConfig, type ConfigMap } from "../api/use-config";
import { Save, Clock, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSessionStore } from "@/features/auth/store";

const CONFIG_SECTIONS: { label: string; keys: { key: string; label: string; unit: string }[] }[] = [
  {
    label: "Loyalty",
    keys: [
      { key: "POINTS_EARN_RATE", label: "IDR per 1 loyalty point", unit: "IDR" },
      { key: "POINTS_REDEEM_RATE", label: "IDR discount per 1 point", unit: "IDR" },
      { key: "POINTS_EXPIRY_MONTHS", label: "Months before points expire", unit: "months" },
      { key: "MAX_REDEMPTION_PERCENT", label: "Max bill % payable by points", unit: "%" },
    ],
  },
  {
    label: "Referrals",
    keys: [
      { key: "REFERRAL_BONUS_POINTS", label: "Points awarded to referrer", unit: "points" },
      { key: "REFERRAL_EXPIRY_DAYS", label: "Days before referral expires", unit: "days" },
    ],
  },
  {
    label: "POS & Tax",
    keys: [
      { key: "CASHIER_DISCOUNT_LIMIT", label: "Max manual discount for cashiers", unit: "%" },
      { key: "TAX_RATE", label: "PPN rate", unit: "%" },
    ],
  },
  {
    label: "Commission Templates",
    keys: [
      { key: "COMMISSION_RATE_MASTER", label: "Default rate for Master barbers", unit: "%" },
      { key: "COMMISSION_RATE_SENIOR", label: "Default rate for Senior barbers", unit: "%" },
      { key: "COMMISSION_RATE_JUNIOR", label: "Default rate for Junior barbers", unit: "%" },
    ],
  },
];

const SELF_SERVICE_FIELDS: {
  key: string;
  unit: string;
  mode: "text" | "toggle";
  labelKey: string;
  descKey: string;
}[] = [
  {
    key: "PREPAYMENT_ENABLED",
    unit: "",
    mode: "toggle",
    labelKey: "prepaymentEnabled",
    descKey: "prepaymentEnabledDesc",
  },
  {
    key: "DEPOSIT_PERCENTAGE",
    unit: "%",
    mode: "text",
    labelKey: "depositPercentage",
    descKey: "depositPercentageDesc",
  },
  {
    key: "CANCELLATION_POLICY_HOURS",
    unit: "h",
    mode: "text",
    labelKey: "cancellationHours",
    descKey: "cancellationHoursDesc",
  },
  {
    key: "CANCELLATION_PENALTY_PERCENTAGE",
    unit: "%",
    mode: "text",
    labelKey: "cancellationPenalty",
    descKey: "cancellationPenaltyDesc",
  },
  {
    key: "WAITLIST_ENABLED",
    unit: "",
    mode: "toggle",
    labelKey: "waitlistEnabled",
    descKey: "waitlistEnabledDesc",
  },
  {
    key: "WAITLIST_MAX_PER_SLOT",
    unit: "",
    mode: "text",
    labelKey: "waitlistMaxPerSlot",
    descKey: "waitlistMaxPerSlotDesc",
  },
];

const EMPTY_CONFIG: ConfigMap = {};

export function ConfigPanel() {
  const org = useSessionStore((s) => s.user?.organization);
  const { t } = useTranslation("config");
  const { data, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const config: ConfigMap = useMemo(() => data?.data ?? EMPTY_CONFIG, [data?.data]);

  const baseValues = useMemo(() => {
    const vals: Record<string, string> = {};
    for (const section of CONFIG_SECTIONS) {
      for (const { key } of section.keys) {
        vals[key] = config[key]?.value ?? "";
      }
    }
    for (const { key, mode } of SELF_SERVICE_FIELDS) {
      const raw = config[key]?.value ?? "";
      if (mode === "toggle") {
        vals[key] = raw === "true" ? "true" : "false";
      } else {
        vals[key] = raw;
      }
    }
    return vals;
  }, [config]);

  function valueFor(key: string) {
    return Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : (baseValues[key] ?? "");
  }

  function handleSave(key: string) {
    const newValue = valueFor(key);
    if (newValue === (config[key]?.value ?? "")) return;

    setSavingKey(key);
    updateConfig.mutate(
      { key, value: newValue },
      { onSettled: () => setSavingKey(null) }
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {CONFIG_SECTIONS.map((section) => (
        <div key={section.label} className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">{section.label}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {section.keys.map(({ key, label, unit }) => {
              const entry = config[key];
              const changed = valueFor(key) !== (entry?.value ?? "");
              const displayUnit = unit === "IDR" ? (org?.currency || "IDR") : unit;
              const displayLabel = label.replace(/\bIDR\b/g, org?.currency || "IDR");

              return (
                <div key={key} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{displayLabel}</p>
                    <p className="text-xs text-slate-400 font-mono">{key}</p>
                    {entry?.updatedAt && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(entry.updatedAt).toLocaleDateString("id-ID")}</span>
                        {entry.updatedBy && (
                          <>
                            <User className="h-3 w-3 ml-1" />
                            <span>{entry.updatedBy.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={valueFor(key)}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                        {/* unit shown in placeholder */}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 w-12">{displayUnit}</span>
                    <button
                      type="button"
                      onClick={() => handleSave(key)}
                      disabled={!changed || savingKey === key}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{t("selfService")}</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {SELF_SERVICE_FIELDS.map(({ key, unit, mode, labelKey, descKey }) => {
            const entry = config[key];
            const stored = entry?.value ?? "";
            const changed =
              mode === "toggle"
                ? valueFor(key) !== (stored === "true" ? "true" : "false")
                : valueFor(key) !== stored;

            return (
              <div key={key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{t(labelKey)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t(descKey)}</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">{key}</p>
                  {entry?.updatedAt && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(entry.updatedAt).toLocaleDateString("id-ID")}</span>
                      {entry.updatedBy && (
                        <>
                          <User className="h-3 w-3 ml-1" />
                          <span>{entry.updatedBy.slice(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mode === "toggle" ? (
                    <Switch
                      checked={valueFor(key) === "true"}
                      onCheckedChange={(checked) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [key]: checked ? "true" : "false",
                        }))
                      }
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        value={valueFor(key)}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {unit ? (
                        <span className="text-xs text-slate-400 w-8">{unit}</span>
                      ) : null}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSave(key)}
                    disabled={!changed || savingKey === key}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors"
                    title={t("saveChanges")}
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {updateConfig.error && (
        <p className="text-sm text-red-600">Error: {(updateConfig.error as Error).message}</p>
      )}
    </div>
  );
}
