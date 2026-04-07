import { Outlet } from "react-router-dom";
import { useMemo } from "react";
import BottomNav from "./BottomNav.tsx";
import { usePusherChannel } from "@/hooks/use-pusher";
import { useSessionStore } from "@/features/auth/store";

export default function AppLayout() {
  const { user } = useSessionStore();
  const notificationKeys = useMemo(() => [["notifications-unread-count"], ["notifications"]], []);
  
  usePusherChannel(
    user?.id ? `user-${user.id}` : null,
    "NOTIFICATION_NEW",
    notificationKeys
  );
  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 relative shadow-xl overflow-x-clip">
      {/* 
        This is a mobile-first PWA envelope.
        On desktop, it restricts width to max-w-md and centers it.
      */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Fixed Navigation at the bottom */}
      <BottomNav />
    </div>
  );
}
