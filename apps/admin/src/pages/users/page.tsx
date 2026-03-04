import { UserManagement } from "@/features/users/widgets/user-management";

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">User Management</h1>
      <UserManagement />
    </div>
  );
}
