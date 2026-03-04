import { AuditViewer } from "@/features/audit/widgets/audit-viewer";

export default function AuditPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <AuditViewer />
    </div>
  );
}
