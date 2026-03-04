export function OfflineBanner() {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline) return null;
  return (
    <div className="bg-amber-500/90 text-amber-950 px-4 py-2 text-center text-sm font-medium">
      You are offline. Transactions will be synced when connection is restored.
    </div>
  );
}
