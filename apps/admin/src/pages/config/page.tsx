import { ConfigPanel } from "@/features/config/widgets/config-panel";

export default function ConfigPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Platform Settings</h1>
      <ConfigPanel />
    </div>
  );
}
