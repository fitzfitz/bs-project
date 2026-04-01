import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  useBranch,
  useUpdateBranch,
  useSetOperatingHours,
  useCreateSurgeRule,
  useDeleteSurgeRule,
  useEmergencyClose,
  useReopenBranch,
  useBranchHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  type OperatingHour,
  type SurgeRule,
  type BranchHoliday,
} from "@/features/branches/api/use-branch-settings";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

type Tab = "details" | "hours" | "surge" | "holidays";

export default function BranchSettingsPage() {
  const { t } = useTranslation();
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const { data, isLoading } = useBranch(branchId);
  const branch = data?.data;
  const [tab, setTab] = useState<Tab>("details");

  if (isLoading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (!branch) return <div className="text-muted-foreground p-4">Select a branch.</div>;

  return (
    <PageContainer>
      <PageHeader title={t("branches:title")} actions={<BranchSelector />} />

      {/* Emergency Closure Banner */}
      {branch.isEmergencyClosed && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-destructive">Branch is Emergency Closed</p>
            <p className="text-xs text-destructive/70">All bookings have been cancelled. Reopen to resume operations.</p>
          </div>
          <ReopenButton branchId={branch.id} />
        </div>
      )}

      <div className="flex gap-1 border-b">
        {(["details", "hours", "surge", "holidays"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "details" ? "Details" : t === "hours" ? "Operating Hours" : t === "surge" ? "Surge Pricing" : "Holidays"}
          </button>
        ))}
      </div>

      {tab === "details" && <BranchDetailsTab key={branch.id} branch={branch} />}
      {tab === "hours" && <OperatingHoursTab key={branch.id} branchId={branch.id} hours={branch.operatingHours ?? []} />}
      {tab === "surge" && <SurgeRulesTab branchId={branch.id} rules={branch.surgeRules ?? []} />}
      {tab === "holidays" && <HolidaysTab branchId={branch.id} />}
    </PageContainer>
  );
}

function ReopenButton({ branchId }: { branchId: string }) {
  const reopen = useReopenBranch();
  return (
    <button
      type="button"
      onClick={() => reopen.mutate(branchId)}
      disabled={reopen.isPending}
      className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
    >
      {reopen.isPending ? "Reopening..." : "Reopen Branch"}
    </button>
  );
}

function BranchDetailsTab({ branch }: { branch: { id: string; name: string; address: string; city: string; phone: string | null; email: string | null; imageUrl?: string | null; tipDistribution?: "PER_STAFF" | "POOLED"; isEmergencyClosed: boolean } }) {
  const updateBranch = useUpdateBranch();
  const emergencyClose = useEmergencyClose();
  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address);
  const [city, setCity] = useState(branch.city);
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [email, setEmail] = useState(branch.email ?? "");
  const [imageUrl, setImageUrl] = useState(branch.imageUrl ?? null);
  const [tipDistribution, setTipDistribution] = useState<"PER_STAFF" | "POOLED">(branch.tipDistribution ?? "PER_STAFF");
  const [confirmClose, setConfirmClose] = useState(false);

  const handleSave = () => {
    updateBranch.mutate({ id: branch.id, name, address, city, phone, email, imageUrl: imageUrl ?? "", tipDistribution });
  };

  return (
    <div className="max-w-lg space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Branch Image</label>
        <ImageUpload
          value={imageUrl}
          prefix="branches"
          entityId={branch.id}
          onUploaded={(url) => setImageUrl(url)}
          onRemove={() => setImageUrl(null)}
        />
      </div>
      {[
        { label: "Name", value: name, set: setName },
        { label: "Address", value: address, set: setAddress },
        { label: "City", value: city, set: setCity },
        { label: "Phone", value: phone, set: setPhone },
        { label: "Email", value: email, set: setEmail },
      ].map(({ label, value, set }) => (
        <div key={label}>
          <label className="block text-sm font-medium mb-1">{label}</label>
          <input type="text" value={value} onChange={(e) => set(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium mb-1">Tip Distribution</label>
        <select value={tipDistribution} onChange={(e) => setTipDistribution(e.target.value as "PER_STAFF" | "POOLED")} className="w-full rounded border px-3 py-1.5 text-sm">
          <option value="PER_STAFF">Per Barber (tips go to serving barber)</option>
          <option value="POOLED">Pooled (tips split equally among barbers who worked that day)</option>
        </select>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={updateBranch.isPending}
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {updateBranch.isPending ? "Saving..." : "Save Changes"}
      </button>

      {/* Emergency Closure */}
      {!branch.isEmergencyClosed && (
        <div className="mt-6 pt-6 border-t border-destructive/20">
          <h3 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Emergency close will cancel all active queue entries and today's bookings immediately.
          </p>
          {confirmClose ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { emergencyClose.mutate(branch.id); setConfirmClose(false); }}
                disabled={emergencyClose.isPending}
                className="rounded bg-destructive px-4 py-1.5 text-sm text-destructive-foreground disabled:opacity-50"
              >
                {emergencyClose.isPending ? "Closing..." : "Yes, Emergency Close"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="rounded border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="rounded border border-destructive/40 bg-destructive/5 px-4 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              Emergency Close Branch
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OperatingHoursTab({ branchId, hours }: { branchId: string; hours: OperatingHour[] }) {
  const setHours = useSetOperatingHours();
  const [form, setForm] = useState(() =>
    DAYS.map((day) => {
      const existing = hours.find((h) => h.dayOfWeek === day);
      return {
        dayOfWeek: day,
        openTime: existing?.openTime ?? "09:00",
        closeTime: existing?.closeTime ?? "21:00",
        isClosed: existing?.isClosed ?? false,
      };
    })
  );


  const handleSave = () => {
    setHours.mutate({ id: branchId, hours: form });
  };

  return (
    <div className="space-y-3 max-w-lg">
      {form.map((row, i) => (
        <div key={row.dayOfWeek} className="flex items-center gap-3">
          <span className="w-24 text-sm font-medium">{row.dayOfWeek.slice(0, 3)}</span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={row.isClosed}
              onChange={(e) => {
                const next = [...form];
                next[i] = { ...next[i], isClosed: e.target.checked };
                setForm(next);
              }}
            />
            Closed
          </label>
          {!row.isClosed && (
            <>
              <input
                type="time"
                value={row.openTime}
                onChange={(e) => {
                  const next = [...form];
                  next[i] = { ...next[i], openTime: e.target.value };
                  setForm(next);
                }}
                className="rounded border px-2 py-1 text-sm"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="time"
                value={row.closeTime}
                onChange={(e) => {
                  const next = [...form];
                  next[i] = { ...next[i], closeTime: e.target.value };
                  setForm(next);
                }}
                className="rounded border px-2 py-1 text-sm"
              />
            </>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleSave}
        disabled={setHours.isPending}
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {setHours.isPending ? "Saving..." : "Save Hours"}
      </button>
    </div>
  );
}

function SurgeRulesTab({ branchId, rules }: { branchId: string; rules: SurgeRule[] }) {
  const createRule = useCreateSurgeRule();
  const deleteRule = useDeleteSurgeRule();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [day, setDay] = useState<string>("SATURDAY");
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(14);
  const [multiplier, setMultiplier] = useState(1.5);

  const handleAdd = async () => {
    if (!name) return;
    await createRule.mutateAsync({ branchId, name, dayOfWeek: day, startHour, endHour, multiplier });
    setShowAdd(false);
    setName("");
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setShowAdd(true)} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground">
        + Add Surge Rule
      </button>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Day</th>
              <th className="px-3 py-2 text-left font-medium">Hours</th>
              <th className="px-3 py-2 text-left font-medium">Multiplier</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No surge rules configured.</td></tr>
            ) : rules.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.dayOfWeek.slice(0, 3)}</td>
                <td className="px-3 py-2">{r.startHour}:00 - {r.endHour}:00</td>
                <td className="px-3 py-2">{r.multiplier}x</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => deleteRule.mutate({ branchId, ruleId: r.id })}
                    className="text-destructive text-xs hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Surge Rule</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="e.g. Weekend Peak" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Day</label>
                <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm">
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Hour</label>
                  <input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Hour</label>
                  <input type="number" min={0} max={23} value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Multiplier</label>
                <input type="number" step={0.1} min={1} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} className="w-full rounded border px-3 py-1.5 text-sm" />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name || createRule.isPending}
                className="w-full rounded bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {createRule.isPending ? "Creating..." : "Add Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HolidaysTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useBranchHolidays(branchId);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isClosed, setIsClosed] = useState(true);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("17:00");

  const holidays: BranchHoliday[] = data?.data ?? [];

  const handleAdd = async () => {
    if (!name || !date) return;
    await createHoliday.mutateAsync({
      branchId,
      name,
      date,
      isClosed,
      openTime: isClosed ? null : openTime,
      closeTime: isClosed ? null : closeTime,
    });
    setShowAdd(false);
    setName("");
    setDate("");
    setIsClosed(true);
  };

  if (isLoading) return <div className="text-muted-foreground text-sm py-4">Loading holidays...</div>;

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setShowAdd(true)} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground">
        + Add Holiday
      </button>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Hours</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holidays.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No holidays configured.</td></tr>
            ) : holidays.map((h) => (
              <tr key={h.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums">{new Date(h.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-3 py-2 font-medium">{h.name}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${h.isClosed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {h.isClosed ? "Closed" : "Special Hours"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {h.isClosed ? "—" : `${h.openTime} – ${h.closeTime}`}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => deleteHoliday.mutate({ branchId, holidayId: h.id })}
                    className="text-destructive text-xs hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Holiday</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="e.g. Hari Raya Idul Fitri" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
                Fully closed (no service)
              </label>
              {!isClosed && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Open Time</label>
                    <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Close Time</label>
                    <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name || !date || createHoliday.isPending}
                className="w-full rounded bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {createHoliday.isPending ? "Creating..." : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
